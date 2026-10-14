// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IOracle} from "morpho-blue/interfaces/IOracle.sol";

type FixedId is bytes32;

/// @notice One fixed-term market: loan token lent against one collateral, priced by a Morpho-style oracle
///         (1e36-scaled), with one liquidation LTV and one maturity. Immutable once created.
struct FixedMarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    uint256 lltv; // 1e18 = 100 %
    uint256 maturity; // unix seconds, 00:00 UTC by convention
}

struct FixedMarket {
    uint128 totalDebtFace; // face value owed by all borrowers at maturity
    uint128 totalClaims; // face value owed to all lenders (>= totalDebtFace after a write-off)
    uint128 repaidAssets; // loan tokens returned by repayments and liquidations, not yet redeemed
    uint128 totalCollateral;
    bool created;
}

/// @notice A lender's resting quote. `price` is loan tokens paid today per 1 loan token owed at maturity (1e18 =
///         par). Paying 0.99 today for 1.00 at maturity is a 1.01 % fixed return for the term.
struct Offer {
    address lender;
    FixedId market;
    uint128 assets; // unfilled principal still escrowed
    uint64 price; // 1e18 scale, MIN_PRICE..1e18
    uint40 expiry; // offer stops being fillable here (<= market maturity)
}

struct FixedPosition {
    uint128 collateral;
    uint128 debtFace; // owed at maturity; a zero-coupon bond, so no interest accrues
}

/// @title FixedTermMarket
/// @notice netlend.finance's fixed-rate, fixed-maturity USDG markets. Mirrors what Longbow exposes on Morpho Midnight
///         (rate is a price quoted by lenders, maturity is a hard deadline, lending is locked until repayments) with
///         our own GPL code because Midnight core is BUSL-1.1 and is not deployed on Robinhood testnet.
///
///         Lifecycle: a lender escrows loan tokens in an offer at a price. A borrower posts collateral and fills the
///         offer: receives `face * price` today, owes `face` at maturity. Debt is counted at face from day one, so a
///         position behaves like a zero-coupon bond. Any position with debt can be liquidated once the oracle says it
///         is unhealthy, and from maturity onwards regardless of health. Lenders redeem face value only from what has
///         been repaid or recovered, first come first served; an unfilled offer can be cancelled at any time.
///         No protocol fee in v1 (disclosed on the Fixed page).
contract FixedTermMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant WAD = 1e18;
    uint256 internal constant ORACLE_PRICE_SCALE = 1e36;
    uint256 internal constant LIQUIDATION_CURSOR = 0.3e18; // same curve as Morpho Blue
    uint256 internal constant MAX_LIQUIDATION_INCENTIVE_FACTOR = 1.15e18;
    uint256 public constant MAX_TERM = 365 days;
    uint256 public constant MIN_PRICE = 0.5e18; // caps the fixed rate at 100 % for the term

    address public owner;
    mapping(uint256 => bool) public isLltvEnabled;
    mapping(FixedId => FixedMarketParams) public idToMarketParams;
    mapping(FixedId => FixedMarket) public market;
    mapping(FixedId => mapping(address => FixedPosition)) public position;
    mapping(FixedId => mapping(address => uint256)) public claims; // lender => face redeemable
    mapping(uint256 => Offer) public offers;
    uint256 public offerCount;

    event SetOwner(address indexed owner);
    event EnableLltv(uint256 lltv);
    event CreateMarket(FixedId indexed id, FixedMarketParams params);
    event PostOffer(FixedId indexed id, uint256 indexed offerId, address indexed lender, uint256 assets, uint256 price, uint256 expiry);
    event CancelOffer(uint256 indexed offerId, uint256 refunded);
    event SupplyCollateral(FixedId indexed id, address indexed caller, address indexed onBehalf, uint256 assets);
    event WithdrawCollateral(FixedId indexed id, address indexed caller, address indexed receiver, uint256 assets);
    event Borrow(FixedId indexed id, uint256 indexed offerId, address indexed borrower, address lender, uint256 face, uint256 proceeds);
    event Repay(FixedId indexed id, address indexed caller, address indexed onBehalf, uint256 face);
    event Liquidate(FixedId indexed id, address indexed caller, address indexed borrower, uint256 repaidFace, uint256 seizedAssets, uint256 badDebt);
    event Redeem(FixedId indexed id, address indexed lender, address indexed receiver, uint256 face);

    error NotOwner();
    error LltvNotEnabled();
    error MarketAlreadyCreated();
    error MarketNotCreated();
    error BadMaturity();
    error Matured();
    error NotMatured();
    error ZeroAssets();
    error BadPrice();
    error BadExpiry();
    error OfferExpired();
    error OfferTooSmall();
    error NotLender();
    error InsufficientCollateral();
    error InsufficientDebt();
    error HealthyPosition();
    error NothingRepaidYet();
    error InsufficientClaim();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;
        emit SetOwner(owner_);
    }

    // ---------------------------------------------------------------- admin

    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
        emit SetOwner(newOwner);
    }

    function enableLltv(uint256 lltv) external onlyOwner {
        if (lltv >= WAD) revert LltvNotEnabled();
        isLltvEnabled[lltv] = true;
        emit EnableLltv(lltv);
    }

    // -------------------------------------------------------------- markets

    function id(FixedMarketParams memory p) public pure returns (FixedId) {
        return FixedId.wrap(keccak256(abi.encode(p)));
    }

    /// @notice Permissionless like Morpho: anyone can open a market on an enabled LLTV with a maturity within a year.
    function createMarket(FixedMarketParams memory p) external returns (FixedId mid) {
        if (!isLltvEnabled[p.lltv]) revert LltvNotEnabled();
        if (p.maturity <= block.timestamp || p.maturity > block.timestamp + MAX_TERM) revert BadMaturity();
        if (p.loanToken == address(0) || p.collateralToken == address(0) || p.oracle == address(0)) revert ZeroAddress();
        mid = id(p);
        if (market[mid].created) revert MarketAlreadyCreated();
        market[mid].created = true;
        idToMarketParams[mid] = p;
        emit CreateMarket(mid, p);
    }

    // --------------------------------------------------------------- offers

    /// @notice Escrow `assets` loan tokens as a resting quote at `price` (1e18 = par) until `expiry`.
    function postOffer(FixedId mid, uint256 assets, uint256 price, uint256 expiry) external nonReentrant returns (uint256 offerId) {
        FixedMarketParams memory p = _live(mid);
        if (assets == 0) revert ZeroAssets();
        if (price < MIN_PRICE || price > WAD) revert BadPrice();
        if (expiry <= block.timestamp || expiry > p.maturity) revert BadExpiry();
        offerId = ++offerCount;
        offers[offerId] = Offer(msg.sender, mid, uint128(assets), uint64(price), uint40(expiry));
        IERC20(p.loanToken).safeTransferFrom(msg.sender, address(this), assets);
        emit PostOffer(mid, offerId, msg.sender, assets, price, expiry);
    }

    /// @notice Pull back whatever is still unfilled. Allowed at any time, filled principal is already lent.
    function cancelOffer(uint256 offerId) external nonReentrant returns (uint256 refunded) {
        Offer storage o = offers[offerId];
        if (o.lender != msg.sender) revert NotLender();
        refunded = o.assets;
        o.assets = 0;
        o.expiry = uint40(block.timestamp);
        if (refunded > 0) IERC20(idToMarketParams[o.market].loanToken).safeTransfer(msg.sender, refunded);
        emit CancelOffer(offerId, refunded);
    }

    /// @notice Largest face amount `offerId` can still fund.
    function maxBorrowable(uint256 offerId) external view returns (uint256) {
        Offer memory o = offers[offerId];
        if (o.assets == 0 || block.timestamp >= o.expiry) return 0;
        return uint256(o.assets) * WAD / o.price;
    }

    // ----------------------------------------------------------- borrowers

    function supplyCollateral(FixedId mid, uint256 assets, address onBehalf) external nonReentrant {
        FixedMarketParams memory p = _created(mid);
        if (assets == 0) revert ZeroAssets();
        if (onBehalf == address(0)) revert ZeroAddress();
        position[mid][onBehalf].collateral += uint128(assets);
        market[mid].totalCollateral += uint128(assets);
        IERC20(p.collateralToken).safeTransferFrom(msg.sender, address(this), assets);
        emit SupplyCollateral(mid, msg.sender, onBehalf, assets);
    }

    /// @notice Collateral leaves only while the remaining position is healthy and before maturity, or once debt is 0.
    function withdrawCollateral(FixedId mid, uint256 assets, address receiver) external nonReentrant {
        FixedMarketParams memory p = _created(mid);
        if (assets == 0) revert ZeroAssets();
        if (receiver == address(0)) revert ZeroAddress();
        FixedPosition storage pos = position[mid][msg.sender];
        if (pos.collateral < assets) revert InsufficientCollateral();
        pos.collateral -= uint128(assets);
        market[mid].totalCollateral -= uint128(assets);
        if (pos.debtFace > 0) {
            if (block.timestamp >= p.maturity) revert Matured();
            if (!_isHealthy(p, pos)) revert InsufficientCollateral();
        }
        IERC20(p.collateralToken).safeTransfer(receiver, assets);
        emit WithdrawCollateral(mid, msg.sender, receiver, assets);
    }

    /// @notice Fill `offerId` for `face` loan tokens owed at maturity; receive `face * price` now.
    function borrow(uint256 offerId, uint256 face, address receiver) external nonReentrant returns (uint256 proceeds) {
        Offer storage o = offers[offerId];
        FixedId mid = o.market;
        FixedMarketParams memory p = _live(mid);
        if (face == 0) revert ZeroAssets();
        if (receiver == address(0)) revert ZeroAddress();
        if (block.timestamp >= o.expiry) revert OfferExpired();
        proceeds = face * o.price / WAD;
        if (proceeds == 0 || proceeds > o.assets) revert OfferTooSmall();
        o.assets -= uint128(proceeds);

        FixedPosition storage pos = position[mid][msg.sender];
        pos.debtFace += uint128(face);
        FixedMarket storage m = market[mid];
        m.totalDebtFace += uint128(face);
        m.totalClaims += uint128(face);
        claims[mid][o.lender] += face;
        if (!_isHealthy(p, pos)) revert InsufficientCollateral();

        IERC20(p.loanToken).safeTransfer(receiver, proceeds);
        emit Borrow(mid, offerId, msg.sender, o.lender, face, proceeds);
    }

    /// @notice Repay face value at any time, before or after maturity. Early repayment pays the full face amount.
    function repay(FixedId mid, uint256 face, address onBehalf) external nonReentrant {
        FixedMarketParams memory p = _created(mid);
        if (face == 0) revert ZeroAssets();
        FixedPosition storage pos = position[mid][onBehalf];
        if (pos.debtFace < face) revert InsufficientDebt();
        pos.debtFace -= uint128(face);
        FixedMarket storage m = market[mid];
        m.totalDebtFace -= uint128(face);
        m.repaidAssets += uint128(face);
        IERC20(p.loanToken).safeTransferFrom(msg.sender, address(this), face);
        emit Repay(mid, msg.sender, onBehalf, face);
    }

    // ---------------------------------------------------------- liquidation

    /// @notice Seize up to `seizedAssets` collateral from an unhealthy position, or from any indebted position once the
    ///         market has matured. Repays `seized * price / LIF` of face; the liquidator keeps the LIF discount.
    function liquidate(FixedId mid, address borrower, uint256 seizedAssets)
        external
        nonReentrant
        returns (uint256 seized, uint256 repaidFace)
    {
        FixedMarketParams memory p = _created(mid);
        FixedPosition storage pos = position[mid][borrower];
        if (pos.debtFace == 0) revert InsufficientDebt();
        uint256 price = IOracle(p.oracle).price();
        if (block.timestamp < p.maturity && _isHealthy(p, pos, price)) revert HealthyPosition();
        if (seizedAssets == 0) revert ZeroAssets();

        uint256 lif = liquidationIncentiveFactor(p.lltv);
        seized = seizedAssets > pos.collateral ? pos.collateral : seizedAssets;
        repaidFace = _divUp(seized * price / ORACLE_PRICE_SCALE * WAD, lif);
        if (repaidFace > pos.debtFace) {
            repaidFace = pos.debtFace;
            uint256 wanted = repaidFace * lif / WAD * ORACLE_PRICE_SCALE / price;
            if (wanted < seized) seized = wanted;
        }

        pos.collateral -= uint128(seized);
        pos.debtFace -= uint128(repaidFace);
        FixedMarket storage m = market[mid];
        m.totalCollateral -= uint128(seized);
        m.totalDebtFace -= uint128(repaidFace);
        m.repaidAssets += uint128(repaidFace);

        uint256 badDebt;
        if (pos.collateral == 0 && pos.debtFace > 0) {
            badDebt = pos.debtFace;
            pos.debtFace = 0;
            m.totalDebtFace -= uint128(badDebt); // lenders absorb it: totalClaims now exceeds what can be repaid
        }

        IERC20(p.loanToken).safeTransferFrom(msg.sender, address(this), repaidFace);
        IERC20(p.collateralToken).safeTransfer(msg.sender, seized);
        emit Liquidate(mid, msg.sender, borrower, repaidFace, seized, badDebt);
    }

    // -------------------------------------------------------------- lenders

    /// @notice Redeem face value against loan tokens that borrowers have repaid or liquidations have returned.
    ///         Reverts until enough has come back: lending is locked, exactly as Longbow describes it.
    function redeem(FixedId mid, uint256 face, address receiver) external nonReentrant {
        FixedMarketParams memory p = _created(mid);
        if (face == 0) revert ZeroAssets();
        if (receiver == address(0)) revert ZeroAddress();
        if (claims[mid][msg.sender] < face) revert InsufficientClaim();
        FixedMarket storage m = market[mid];
        if (m.repaidAssets < face) revert NothingRepaidYet();
        claims[mid][msg.sender] -= face;
        m.totalClaims -= uint128(face);
        m.repaidAssets -= uint128(face);
        IERC20(p.loanToken).safeTransfer(receiver, face);
        emit Redeem(mid, msg.sender, receiver, face);
    }

    // ---------------------------------------------------------------- views

    function isHealthy(FixedId mid, address user) external view returns (bool) {
        return _isHealthy(idToMarketParams[mid], position[mid][user]);
    }

    /// @notice Morpho Blue's incentive curve: min(1.15, 1 / (1 - 0.3 * (1 - lltv))).
    function liquidationIncentiveFactor(uint256 lltv) public pure returns (uint256) {
        uint256 lif = WAD * WAD / (WAD - LIQUIDATION_CURSOR * (WAD - lltv) / WAD);
        return lif > MAX_LIQUIDATION_INCENTIVE_FACTOR ? MAX_LIQUIDATION_INCENTIVE_FACTOR : lif;
    }

    /// @notice Simple annualised fixed rate implied by `price` for a loan maturing at `maturity`, 1e18 scale.
    function impliedApr(uint256 price, uint256 maturity) external view returns (uint256) {
        if (maturity <= block.timestamp || price == 0) return 0;
        uint256 termReturn = WAD * WAD / price - WAD; // (1/price - 1)
        return termReturn * 365 days / (maturity - block.timestamp);
    }

    // ------------------------------------------------------------- internal

    function _created(FixedId mid) internal view returns (FixedMarketParams memory p) {
        p = idToMarketParams[mid];
        if (!market[mid].created) revert MarketNotCreated();
    }

    function _live(FixedId mid) internal view returns (FixedMarketParams memory p) {
        p = _created(mid);
        if (block.timestamp >= p.maturity) revert Matured();
    }

    function _isHealthy(FixedMarketParams memory p, FixedPosition memory pos) internal view returns (bool) {
        if (pos.debtFace == 0) return true;
        return _isHealthy(p, pos, IOracle(p.oracle).price());
    }

    function _isHealthy(FixedMarketParams memory p, FixedPosition memory pos, uint256 price) internal pure returns (bool) {
        if (pos.debtFace == 0) return true;
        uint256 maxBorrow = uint256(pos.collateral) * price / ORACLE_PRICE_SCALE * p.lltv / WAD;
        return maxBorrow >= pos.debtFace;
    }

    function _divUp(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a + b - 1) / b;
    }
}
