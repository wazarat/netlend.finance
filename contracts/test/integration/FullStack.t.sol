// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Upstream} from "../../script/lib/Upstream.sol";
import {IMorpho, MarketParams, Id} from "morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "morpho-blue/libraries/MarketParamsLib.sol";
import {IMorphoChainlinkOracleV2Factory} from "morpho-blue-oracles/morpho-chainlink/interfaces/IMorphoChainlinkOracleV2Factory.sol";
import {AggregatorV3Interface} from "morpho-blue-oracles/morpho-chainlink/libraries/ChainlinkDataFeedLib.sol";
import {IERC4626} from "morpho-blue-oracles/morpho-chainlink/libraries/VaultLib.sol";
import {IMetaMorphoV1_1Factory} from "metamorpho/interfaces/IMetaMorphoV1_1Factory.sol";
import {IMetaMorphoV1_1} from "metamorpho/interfaces/IMetaMorphoV1_1.sol";
import {IPublicAllocatorMin, PAWithdrawal, PAFlowCapsConfig, PAFlowCaps, PA_MAX_SETTABLE_FLOW_CAP} from "../../script/lib/PublicAllocatorTypes.sol";

import {MockUSDG} from "../../src/mocks/MockUSDG.sol";
import {MockStockToken} from "../../src/mocks/MockStockToken.sol";
import {MockV3Aggregator} from "../../src/mocks/MockV3Aggregator.sol";
import {MarketHoursFeed, IAggregatorV3} from "../../src/mocks/MarketHoursFeed.sol";
import {UniV3TwapOracleFactory} from "../../src/oracles/UniV3TwapOracleFactory.sol";
import {UniV3TwapOracle} from "../../src/oracles/UniV3TwapOracle.sol";
import {MarketGuard} from "../../src/guard/MarketGuard.sol";

interface IUniV3FactoryMin {
    function createPool(address a, address b, uint24 fee) external returns (address);
}

interface IUniV3PoolMin {
    function initialize(uint160 sqrtPriceX96) external;
    function increaseObservationCardinalityNext(uint16 n) external;
}

interface INPMMin {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    function mint(MintParams calldata p) external payable returns (uint256, uint128, uint256, uint256);
}

/// @title FullStackTest
/// @notice Deploys the whole netlend.finance testnet stack in-process (same order as the deploy scripts) and runs the
///         Longbow loop: supply to the curated vault, borrow against a stock token, liquidate after a price drop,
///         trip the watchdog, price a long-tail market with the TWAP oracle, and take a zero-fee flash loan.
contract FullStackTest is Test {
    using MarketParamsLib for MarketParams;

    address owner = address(this);
    address lender = makeAddr("lender");
    address borrower = makeAddr("borrower");
    address liquidator = makeAddr("liquidator");
    address keeper = makeAddr("keeper");

    IMorpho morpho;
    address irm;
    IMorphoChainlinkOracleV2Factory clFactory;
    IMetaMorphoV1_1Factory mmFactory;
    MockUSDG usdg;
    MockStockToken tsla;
    MockStockToken pons;
    MockV3Aggregator tslaRaw;
    MarketHoursFeed tslaFeed;
    MockV3Aggregator usdgFeed;
    MarketParams tslaMarket;
    MarketParams ponsMarket;
    IMetaMorphoV1_1 vault;
    IPublicAllocatorMin pa;
    MarketGuard guard;
    address uniFactory;
    address npm;

    function setUp() public {
        // Deploy01_Core
        morpho = IMorpho(Upstream.morpho(owner));
        irm = Upstream.adaptiveCurveIrm(address(morpho));
        clFactory = IMorphoChainlinkOracleV2Factory(Upstream.chainlinkOracleV2Factory());
        mmFactory = IMetaMorphoV1_1Factory(Upstream.metaMorphoFactory(address(morpho)));
        morpho.enableIrm(irm);
        morpho.enableLltv(0.385e18);
        morpho.enableLltv(0.625e18);

        // Deploy02_Substitutes
        usdg = new MockUSDG(owner);
        tsla = new MockStockToken("Tesla Stock Token", "rTSLA", owner);
        pons = new MockStockToken("Mock PONS", "mPONS", owner);
        tslaRaw = new MockV3Aggregator(8, "TSLA / USD", 430e8, owner);
        tslaFeed = new MarketHoursFeed(IAggregatorV3(address(tslaRaw)), owner);
        usdgFeed = new MockV3Aggregator(8, "USDG / USD", 1e8, owner);

        // Deploy02b_Uniswap: factory + NPM from vendored artifacts; seed mPONS/USDG at 0.05 USDG
        uniFactory = _deployArtifact("UniswapV3Factory", "");
        npm = _deployArtifact("NonfungiblePositionManager", abi.encode(uniFactory, makeAddr("weth"), address(0)));
        uint256 ponsAmt = 10_000_000e18;
        uint256 usdgAmt = 500_000e6;
        pons.mint(owner, ponsAmt);
        usdg.mint(owner, usdgAmt);
        address pool = _seed(address(pons), ponsAmt, address(usdg), usdgAmt);

        // Deploy03_Oracles
        address tslaOracle = address(
            clFactory.createMorphoChainlinkOracleV2(
                IERC4626(address(0)), 1, AggregatorV3Interface(address(tslaFeed)), AggregatorV3Interface(address(0)), 18,
                IERC4626(address(0)), 1, AggregatorV3Interface(address(usdgFeed)), AggregatorV3Interface(address(0)), 6,
                bytes32("TSLA")
            )
        );
        UniV3TwapOracleFactory twapFactory = new UniV3TwapOracleFactory();
        vm.warp(block.timestamp + 1800);
        address ponsOracle = address(twapFactory.create(pool, address(pons), address(usdg), 1800, bytes32("PONS")));

        // Deploy04_Markets
        tslaMarket = MarketParams(address(usdg), address(tsla), tslaOracle, irm, 0.625e18);
        ponsMarket = MarketParams(address(usdg), address(pons), ponsOracle, irm, 0.385e18);
        morpho.createMarket(tslaMarket);
        morpho.createMarket(ponsMarket);

        // Deploy05_Vaults
        address[] memory keepers = new address[](1);
        keepers[0] = keeper;
        guard = new MarketGuard(owner, keepers);
        vault = mmFactory.createMetaMorpho(owner, 0, address(usdg), "netlend USDG Core", "nlUSDG", bytes32("core"));
        vault.setCurator(owner);
        vault.submitCap(tslaMarket, 100_000e6);
        vault.acceptCap(tslaMarket);
        vault.submitCap(ponsMarket, 25_000e6);
        vault.acceptCap(ponsMarket);
        vault.setIsAllocator(owner, true);
        Id[] memory queue = new Id[](2);
        queue[0] = tslaMarket.id();
        queue[1] = ponsMarket.id();
        vault.setSupplyQueue(queue);
        vault.setFeeRecipient(owner);
        vault.setFee(0.1e18);
        // Deploy05b_FlowCaps: the PublicAllocator is an allocator with open flow caps on both markets
        pa = IPublicAllocatorMin(Upstream.publicAllocator(address(morpho)));
        vault.setIsAllocator(address(pa), true);
        PAFlowCapsConfig[] memory cfg = new PAFlowCapsConfig[](2);
        cfg[0] = PAFlowCapsConfig(tslaMarket.id(), PAFlowCaps(PA_MAX_SETTABLE_FLOW_CAP, PA_MAX_SETTABLE_FLOW_CAP));
        cfg[1] = PAFlowCapsConfig(ponsMarket.id(), PAFlowCaps(PA_MAX_SETTABLE_FLOW_CAP, PA_MAX_SETTABLE_FLOW_CAP));
        pa.setFlowCaps(address(vault), cfg);
        vault.setCurator(address(guard));
        vault.submitTimelock(1 days);

        usdg.mint(lender, 50_000e6);
        tsla.mint(borrower, 10e18);
        usdg.mint(liquidator, 50_000e6);
    }

    function _deployArtifact(string memory file, bytes memory args) internal returns (address addr) {
        bytes memory init = abi.encodePacked(vm.getCode(string.concat("vendor/uniswap/", file, ".json")), args);
        assembly {
            addr := create(0, add(init, 0x20), mload(init))
        }
        require(addr != address(0), "deploy failed");
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function _seed(address tokenA, uint256 amountA, address tokenB, uint256 amountB) internal returns (address pool) {
        (address t0, address t1, uint256 a0, uint256 a1) =
            tokenA < tokenB ? (tokenA, tokenB, amountA, amountB) : (tokenB, tokenA, amountB, amountA);
        pool = IUniV3FactoryMin(uniFactory).createPool(t0, t1, 3000);
        IUniV3PoolMin(pool).initialize(uint160(_sqrt((a1 << 96) / a0) << 48));
        IUniV3PoolMin(pool).increaseObservationCardinalityNext(120);
        IERC20(t0).approve(npm, a0);
        IERC20(t1).approve(npm, a1);
        INPMMin(npm).mint(INPMMin.MintParams(t0, t1, 3000, -887220, 887220, a0, a1, 0, 0, owner, block.timestamp + 1));
    }

    function _supply(uint256 amount) internal {
        vm.startPrank(lender);
        usdg.approve(address(vault), amount);
        vault.deposit(amount, lender);
        vm.stopPrank();
    }

    function _borrow(uint256 collateral, uint256 debt) internal {
        vm.startPrank(borrower);
        tsla.approve(address(morpho), collateral);
        morpho.supplyCollateral(tslaMarket, collateral, borrower, "");
        morpho.borrow(tslaMarket, debt, 0, borrower, borrower);
        vm.stopPrank();
    }

    function test_earn_vault_allocates_to_markets_and_borrow_works() public {
        _supply(20_000e6);
        assertGt(vault.balanceOf(lender), 0);
        uint128 totalSupplyAssets = morpho.market(tslaMarket.id()).totalSupplyAssets;
        assertEq(totalSupplyAssets, 20_000e6, "supply queue routes to TSLA market first");
        _borrow(10e18, 2_000e6); // 10 TSLA @ 430 = 4,300; LTV 46.5%
        assertEq(usdg.balanceOf(borrower), 2_000e6);
        assertEq(vault.maxWithdraw(lender), 18_000e6, "withdrawable = supplied - borrowed");
    }

    function test_public_allocator_pulls_liquidity_into_the_borrow_market() public {
        _supply(20_000e6); // everything lands in TSLA, first in the supply queue; PONS has nothing to lend
        assertEq(morpho.market(ponsMarket.id()).totalSupplyAssets, 0);

        // The borrower (anyone) moves 5,000 USDG TSLA -> PONS through the PublicAllocator, fee 0, within the PONS cap.
        PAWithdrawal[] memory w = new PAWithdrawal[](1);
        w[0] = PAWithdrawal(tslaMarket, 5_000e6);
        vm.prank(borrower);
        pa.reallocateTo(address(vault), w, ponsMarket);
        assertEq(morpho.market(ponsMarket.id()).totalSupplyAssets, 5_000e6, "pulled into PONS");
        assertEq(morpho.market(tslaMarket.id()).totalSupplyAssets, 15_000e6, "taken from TSLA");
        assertEq(vault.totalAssets(), 20_000e6, "vault unchanged");

        // and the borrow that needed it goes through: 10,000 mPONS @ 0.05 = 500 USDG, LLTV 38.5% -> borrow 150
        pons.mint(borrower, 10_000e18);
        vm.startPrank(borrower);
        pons.approve(address(morpho), 10_000e18);
        morpho.supplyCollateral(ponsMarket, 10_000e18, borrower, "");
        morpho.borrow(ponsMarket, 150e6, 0, borrower, borrower);
        vm.stopPrank();
        assertEq(usdg.balanceOf(borrower), 150e6);

        // a second pull of 15,000 stays under the 25,000 PONS cap; pulling 20,000 back out of PONS fails because
        // 150 of it is lent, so the vault can only withdraw 19,850 (MetaMorpho NotEnoughLiquidity).
        w[0].amount = 15_000e6;
        vm.prank(borrower);
        pa.reallocateTo(address(vault), w, ponsMarket);
        assertEq(morpho.market(ponsMarket.id()).totalSupplyAssets, 20_000e6);
        PAWithdrawal[] memory back = new PAWithdrawal[](1);
        back[0] = PAWithdrawal(ponsMarket, 20_000e6);
        vm.prank(borrower);
        vm.expectRevert();
        pa.reallocateTo(address(vault), back, tslaMarket);
    }

    function test_borrow_above_lltv_reverts() public {
        _supply(20_000e6);
        vm.startPrank(borrower);
        tsla.approve(address(morpho), 10e18);
        morpho.supplyCollateral(tslaMarket, 10e18, borrower, "");
        vm.expectRevert(bytes("insufficient collateral"));
        morpho.borrow(tslaMarket, 2_700e6, 0, borrower, borrower); // 62.8% > 62.5%
        vm.stopPrank();
    }

    function test_price_drop_makes_position_liquidatable() public {
        _supply(20_000e6);
        _borrow(10e18, 2_600e6); // LTV 60.5%
        tslaRaw.updateAnswer(380e8); // collateral 3,800 → LTV 68%
        vm.startPrank(liquidator);
        usdg.approve(address(morpho), type(uint256).max);
        (uint256 seized, uint256 repaid) = morpho.liquidate(tslaMarket, borrower, 5e18, 0, "");
        vm.stopPrank();
        assertEq(seized, 5e18);
        assertGt(repaid, 0);
        assertEq(tsla.balanceOf(liquidator), 5e18);
    }

    function test_weekend_freeze_holds_price_then_gap_liquidates() public {
        tslaFeed.setTradingOpen(false); // Friday close
        tslaRaw.updateAnswer(300e8); // the real world moves while the feed holds 430
        _supply(20_000e6);
        _borrow(10e18, 2_600e6); // allowed at the frozen print: the Monday-gap tail
        tslaFeed.setTradingOpen(true); // reopen at 300: 3,000 of collateral vs 2,600 debt
        vm.startPrank(liquidator);
        usdg.approve(address(morpho), type(uint256).max);
        morpho.liquidate(tslaMarket, borrower, 1e18, 0, "");
        vm.stopPrank();
    }

    function test_watchdog_trip_caps_market_to_zero() public {
        _supply(10_000e6);
        vm.prank(keeper);
        guard.trip(vault, tslaMarket, "oracle divergence > 2%");
        uint184 cap = vault.config(tslaMarket.id()).cap;
        assertEq(cap, 0);
        _supply(5_000e6); // must route to PONS now
        uint128 tslaSupply = morpho.market(tslaMarket.id()).totalSupplyAssets;
        uint128 ponsSupply = morpho.market(ponsMarket.id()).totalSupplyAssets;
        assertEq(tslaSupply, 10_000e6);
        assertEq(ponsSupply, 5_000e6);
        vm.expectRevert(MarketGuard.StillTripped.selector);
        guard.forwardSubmitCap(vault, tslaMarket, 1e6);
    }

    function test_twap_oracle_prices_long_tail_market() public view {
        uint256 p = UniV3TwapOracle(ponsMarket.oracle).price();
        assertApproxEqRel(p, 5e22, 0.01e18); // 0.05 USDG/PONS = 5e11 / 1e25 base units, times 1e36
    }

    function test_flash_loan_is_free_and_atomic() public {
        _supply(20_000e6);
        FlashBorrower fb = new FlashBorrower(address(morpho), address(usdg));
        uint256 before = usdg.balanceOf(address(morpho));
        fb.run(15_000e6);
        assertEq(usdg.balanceOf(address(morpho)), before, "balance unchanged after flash loan");
        assertEq(fb.received(), 15_000e6);
    }
}

/// @dev Mirrors Longbow's documented FlashBorrower example.
contract FlashBorrower {
    IMorpho immutable morpho;
    address immutable usdg;
    uint256 public received;

    constructor(address m, address u) {
        morpho = IMorpho(m);
        usdg = u;
    }

    function run(uint256 amount) external {
        morpho.flashLoan(usdg, amount, abi.encode(amount));
    }

    function onMorphoFlashLoan(uint256 assets, bytes calldata) external {
        require(msg.sender == address(morpho), "only settlement");
        received = assets;
        IERC20(usdg).approve(address(morpho), assets);
    }
}
