// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {FixedTermMarket, FixedMarketParams, FixedId} from "../../src/fixed/FixedTermMarket.sol";
import {MockUSDG} from "../../src/mocks/MockUSDG.sol";
import {MockStockToken} from "../../src/mocks/MockStockToken.sol";

/// @dev Morpho-style oracle: price of 1 collateral in loan units, 1e36-scaled.
contract MockOracle {
    uint256 public price;

    constructor(uint256 p) {
        price = p;
    }

    function set(uint256 p) external {
        price = p;
    }
}

contract FixedTermMarketTest is Test {
    uint256 constant WAD = 1e18;
    uint256 constant SCALE = 1e36;

    FixedTermMarket fx;
    MockUSDG usdg;
    MockStockToken tsla;
    MockOracle oracle;
    FixedMarketParams params;
    FixedId id;

    address lender = makeAddr("lender");
    address lender2 = makeAddr("lender2");
    address borrower = makeAddr("borrower");
    address liquidator = makeAddr("liquidator");
    uint256 maturity;

    /// @dev 430 USDG (6 dp) per 1 TSLA (18 dp): 430e6 * 1e36 / 1e18.
    uint256 constant PX_430 = 430e6 * SCALE / 1e18;

    function setUp() public {
        vm.warp(1_800_000_000);
        fx = new FixedTermMarket(address(this));
        fx.enableLltv(0.625e18);
        usdg = new MockUSDG(address(this));
        tsla = new MockStockToken("Tesla Stock Token", "rTSLA", address(this));
        oracle = new MockOracle(PX_430);
        maturity = block.timestamp + 30 days;
        params = FixedMarketParams(address(usdg), address(tsla), address(oracle), 0.625e18, maturity);
        id = fx.createMarket(params);

        usdg.mint(lender, 100_000e6);
        usdg.mint(lender2, 100_000e6);
        usdg.mint(liquidator, 100_000e6);
        tsla.mint(borrower, 100e18);
        vm.prank(lender);
        usdg.approve(address(fx), type(uint256).max);
        vm.prank(lender2);
        usdg.approve(address(fx), type(uint256).max);
        vm.prank(liquidator);
        usdg.approve(address(fx), type(uint256).max);
        vm.startPrank(borrower);
        tsla.approve(address(fx), type(uint256).max);
        usdg.approve(address(fx), type(uint256).max);
        vm.stopPrank();
    }

    function _offer(address who, uint256 assets, uint256 price) internal returns (uint256 oid) {
        vm.prank(who);
        oid = fx.postOffer(id, assets, price, maturity);
    }

    function _borrow(uint256 oid, uint256 collateral, uint256 face) internal returns (uint256 proceeds) {
        vm.startPrank(borrower);
        fx.supplyCollateral(id, collateral, borrower);
        proceeds = fx.borrow(oid, face, borrower);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ markets

    function test_create_market_validations() public {
        FixedMarketParams memory p = params;
        p.lltv = 0.9e18;
        vm.expectRevert(FixedTermMarket.LltvNotEnabled.selector);
        fx.createMarket(p);
        p = params;
        p.maturity = block.timestamp + 400 days;
        vm.expectRevert(FixedTermMarket.BadMaturity.selector);
        fx.createMarket(p);
        vm.expectRevert(FixedTermMarket.MarketAlreadyCreated.selector);
        fx.createMarket(params);
    }

    // ------------------------------------------------------------- offers

    function test_offer_fill_pays_discounted_proceeds_and_books_claim() public {
        uint256 oid = _offer(lender, 10_000e6, 0.99e18);
        assertEq(usdg.balanceOf(address(fx)), 10_000e6);
        uint256 proceeds = _borrow(oid, 10e18, 2_000e6); // 10 TSLA = 4,300 USDG; 2,000 face = 46.5 % LTV
        assertEq(proceeds, 1_980e6, "face * 0.99");
        assertEq(usdg.balanceOf(borrower), 1_980e6);
        assertEq(fx.claims(id, lender), 2_000e6, "lender is owed face at maturity");
        (, uint128 debt) = fx.position(id, borrower);
        assertEq(debt, 2_000e6);
        (, uint128 remaining,,) = _offerView(oid);
        assertEq(remaining, 10_000e6 - 1_980e6);
        assertApproxEqRel(fx.impliedApr(0.99e18, maturity), 0.1229e18, 0.01e18); // ~12.3 % simple APR
    }

    function test_borrow_above_lltv_reverts() public {
        uint256 oid = _offer(lender, 10_000e6, 0.99e18);
        vm.startPrank(borrower);
        fx.supplyCollateral(id, 10e18, borrower);
        vm.expectRevert(FixedTermMarket.InsufficientCollateral.selector);
        fx.borrow(oid, 2_700e6, borrower); // 62.8 % > 62.5 % (debt counted at face)
        vm.stopPrank();
    }

    function test_cancel_refunds_unfilled_principal_only() public {
        uint256 oid = _offer(lender, 10_000e6, 0.99e18);
        _borrow(oid, 10e18, 2_000e6);
        vm.prank(lender);
        uint256 refunded = fx.cancelOffer(oid);
        assertEq(refunded, 10_000e6 - 1_980e6);
        assertEq(usdg.balanceOf(lender), 100_000e6 - 1_980e6);
        assertEq(fx.maxBorrowable(oid), 0);
        vm.prank(lender2);
        vm.expectRevert(FixedTermMarket.NotLender.selector);
        fx.cancelOffer(oid);
    }

    function test_expired_offer_and_matured_market_cannot_be_filled() public {
        vm.prank(lender);
        uint256 oid = fx.postOffer(id, 1_000e6, 0.99e18, block.timestamp + 1 days);
        vm.warp(block.timestamp + 1 days);
        vm.startPrank(borrower);
        fx.supplyCollateral(id, 10e18, borrower);
        vm.expectRevert(FixedTermMarket.OfferExpired.selector);
        fx.borrow(oid, 100e6, borrower);
        vm.stopPrank();
        uint256 oid2 = _offer(lender, 1_000e6, 0.99e18);
        vm.warp(maturity);
        vm.prank(borrower);
        vm.expectRevert(FixedTermMarket.Matured.selector);
        fx.borrow(oid2, 100e6, borrower);
        vm.prank(lender);
        vm.expectRevert(FixedTermMarket.Matured.selector);
        fx.postOffer(id, 1e6, 0.99e18, maturity);
    }

    // ------------------------------------------------------ repay / redeem

    function test_lending_is_locked_until_repayment_then_redeems_face() public {
        uint256 oid = _offer(lender, 10_000e6, 0.99e18);
        _borrow(oid, 10e18, 2_000e6);
        vm.prank(lender);
        vm.expectRevert(FixedTermMarket.NothingRepaidYet.selector);
        fx.redeem(id, 2_000e6, lender);

        usdg.mint(borrower, 20e6); // the 1 % the borrower owes on top of proceeds
        vm.prank(borrower);
        fx.repay(id, 2_000e6, borrower);
        (, uint128 debt) = fx.position(id, borrower);
        assertEq(debt, 0);

        vm.prank(lender);
        fx.redeem(id, 2_000e6, lender);
        assertEq(usdg.balanceOf(lender), 100_000e6 - 10_000e6 + 2_000e6, "face back, principal still in open offer");
        assertEq(fx.claims(id, lender), 0);
        vm.prank(lender);
        vm.expectRevert(FixedTermMarket.InsufficientClaim.selector);
        fx.redeem(id, 1, lender);
    }

    function test_collateral_withdraw_respects_health_and_maturity() public {
        uint256 oid = _offer(lender, 10_000e6, 0.99e18);
        _borrow(oid, 10e18, 2_000e6);
        usdg.mint(borrower, 20e6);
        vm.startPrank(borrower);
        fx.withdrawCollateral(id, 2e18, borrower); // 8 TSLA = 3,440; 2,000 / 3,440 = 58 % ok
        vm.expectRevert(FixedTermMarket.InsufficientCollateral.selector);
        fx.withdrawCollateral(id, 1e18, borrower); // 7 TSLA = 3,010; 66 % > 62.5 %
        vm.warp(maturity);
        vm.expectRevert(FixedTermMarket.Matured.selector);
        fx.withdrawCollateral(id, 1e18, borrower);
        fx.repay(id, 2_000e6, borrower);
        fx.withdrawCollateral(id, 8e18, borrower); // debt 0: always allowed
        vm.stopPrank();
        assertEq(tsla.balanceOf(borrower), 100e18);
    }

    // --------------------------------------------------------- liquidation

    function test_healthy_position_not_liquidatable_before_maturity() public {
        uint256 oid = _offer(lender, 10_000e6, 0.99e18);
        _borrow(oid, 10e18, 2_000e6);
        vm.prank(liquidator);
        vm.expectRevert(FixedTermMarket.HealthyPosition.selector);
        fx.liquidate(id, borrower, 1e18);
    }

    function test_price_drop_liquidation_pays_lif_discount_into_repaid_pool() public {
        uint256 oid = _offer(lender, 10_000e6, 0.99e18);
        _borrow(oid, 10e18, 2_600e6); // 60.5 % LTV
        oracle.set(380e6 * SCALE / 1e18); // 3,800 collateral → 68 %
        uint256 lif = fx.liquidationIncentiveFactor(0.625e18);
        assertApproxEqRel(lif, 1.1268e18, 0.001e18); // Longbow's quoted ~12.7 % bonus at 62.5 %
        vm.prank(liquidator);
        (uint256 seized, uint256 repaid) = fx.liquidate(id, borrower, 5e18);
        assertEq(seized, 5e18);
        assertApproxEqAbs(repaid, 5 * 380e6 * WAD / lif, 1); // 1,900 / 1.1268 ≈ 1,686
        assertEq(tsla.balanceOf(liquidator), 5e18);
        (,, uint128 repaidAssets,,) = fx.market(id);
        assertEq(repaidAssets, repaid, "liquidation proceeds become redeemable");
        vm.prank(lender);
        fx.redeem(id, repaid, lender);
    }

    function test_after_maturity_any_debt_is_liquidatable() public {
        uint256 oid = _offer(lender, 10_000e6, 0.99e18);
        _borrow(oid, 10e18, 1_000e6); // 23 % LTV, very healthy
        vm.warp(maturity);
        vm.prank(liquidator);
        (uint256 seized, uint256 repaid) = fx.liquidate(id, borrower, 10e18);
        assertEq(repaid, 1_000e6, "capped at the debt");
        assertLt(seized, 10e18, "only enough collateral to cover debt * LIF");
        (uint128 coll, uint128 debt) = fx.position(id, borrower);
        assertEq(debt, 0);
        assertEq(coll, 10e18 - seized);
    }

    function test_bad_debt_is_written_off_and_lenders_share_what_came_back() public {
        uint256 oid = _offer(lender, 10_000e6, 0.99e18);
        _borrow(oid, 10e18, 2_600e6);
        oracle.set(200e6 * SCALE / 1e18); // crash: 2,000 of collateral vs 2,600 debt
        vm.prank(liquidator);
        (uint256 seized, uint256 repaid) = fx.liquidate(id, borrower, 10e18);
        assertEq(seized, 10e18);
        assertLt(repaid, 2_600e6);
        (uint128 coll, uint128 debt) = fx.position(id, borrower);
        assertEq(coll, 0);
        assertEq(debt, 0, "remaining debt written off");
        (uint128 totalDebt, uint128 totalClaims, uint128 repaidAssets,,) = fx.market(id);
        assertEq(totalDebt, 0);
        assertEq(totalClaims, 2_600e6, "claims still at face; the shortfall is the lenders' loss");
        assertEq(repaidAssets, repaid);
        vm.startPrank(lender);
        vm.expectRevert(FixedTermMarket.NothingRepaidYet.selector);
        fx.redeem(id, 2_600e6, lender);
        fx.redeem(id, repaid, lender);
        vm.stopPrank();
    }

    function test_loan_token_balance_equals_open_offers_plus_repaid_pool() public {
        uint256 a = _offer(lender, 10_000e6, 0.99e18);
        uint256 b = _offer(lender2, 5_000e6, 0.98e18);
        _borrow(a, 20e18, 3_000e6);
        vm.prank(borrower);
        fx.borrow(b, 1_000e6, borrower);
        usdg.mint(borrower, 1_000e6);
        vm.prank(borrower);
        fx.repay(id, 1_500e6, borrower);
        (, uint128 ra,,) = _offerView(a);
        (, uint128 rb,,) = _offerView(b);
        (,, uint128 repaidAssets,,) = fx.market(id);
        assertEq(usdg.balanceOf(address(fx)), uint256(ra) + rb + repaidAssets);
    }

    function _offerView(uint256 oid) internal view returns (address l, uint128 assets, uint64 price, uint40 expiry) {
        (l,, assets, price, expiry) = fx.offers(oid);
    }
}
