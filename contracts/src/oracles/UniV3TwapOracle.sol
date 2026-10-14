// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IOracle} from "morpho-blue/interfaces/IOracle.sol";

interface IUniswapV3PoolMinimal {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
}

/// @title UniV3TwapOracle
/// @notice Morpho IOracle backed by a long-window Uniswap v3 TWAP. Used for long-tail collateral that has no
///         Chainlink feed (Longbow's "Uniswap V3 TWAP (trustless)" markets). Returns the price of one unit of
///         collateral (in base units) in loan-token base units, scaled by 1e36 as Morpho expects. Uniswap's tick
///         ratio is already expressed in base units, so price = twapRatio(loan per collateral) * 1e36.
///         The window is immutable; manipulation cost grows with window length and pool liquidity.
contract UniV3TwapOracle is IOracle {
    IUniswapV3PoolMinimal public immutable pool;
    address public immutable collateralToken;
    address public immutable loanToken;
    uint32 public immutable window; // seconds
    bool internal immutable collateralIsToken0;
    uint256 internal constant SCALE = 1e36;

    error BadWindow();
    error TokenNotInPool();

    constructor(address pool_, address collateralToken_, address loanToken_, uint32 window_) {
        if (window_ == 0) revert BadWindow();
        pool = IUniswapV3PoolMinimal(pool_);
        address t0 = pool.token0();
        address t1 = pool.token1();
        if (!((t0 == collateralToken_ && t1 == loanToken_) || (t1 == collateralToken_ && t0 == loanToken_))) {
            revert TokenNotInPool();
        }
        collateralToken = collateralToken_;
        loanToken = loanToken_;
        window = window_;
        collateralIsToken0 = (t0 == collateralToken_);
    }

    /// @notice Arithmetic-mean tick over `window`, converted to a 1e36-scaled collateral/loan price.
    function price() external view returns (uint256) {
        uint32[] memory ago = new uint32[](2);
        ago[0] = window;
        ago[1] = 0;
        (int56[] memory ticks,) = pool.observe(ago);
        int56 delta = ticks[1] - ticks[0];
        int24 meanTick = int24(delta / int56(uint56(window)));
        // round toward negative infinity, as Uniswap's OracleLibrary does
        if (delta < 0 && (delta % int56(uint56(window)) != 0)) meanTick--;

        uint160 sqrtP = _sqrtRatioAtTick(meanTick); // sqrt(token1/token0) * 2^96
        // token1 per token0, scaled 2^192
        uint256 ratioX192 = uint256(sqrtP) * uint256(sqrtP);
        if (collateralIsToken0) {
            // price(coll in loan) = token1/token0
            return _mulDiv(ratioX192, SCALE, 1 << 192);
        } else {
            // price(coll in loan) = token0/token1 = 2^192 / ratio
            return _mulDiv(1 << 192, SCALE, ratioX192);
        }
    }

    /// @dev Port of Uniswap v3 TickMath.getSqrtRatioAtTick for Solidity 0.8.
    function _sqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        unchecked {
            uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
            require(absTick <= 887272, "T");
            uint256 ratio = absTick & 0x1 != 0 ? 0xfffcb933bd6fad37aa2d162d1a594001 : 0x100000000000000000000000000000000;
            if (absTick & 0x2 != 0) ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
            if (absTick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
            if (absTick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
            if (absTick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
            if (absTick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
            if (absTick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
            if (absTick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
            if (absTick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
            if (absTick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
            if (absTick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
            if (absTick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
            if (absTick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
            if (absTick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
            if (absTick & 0x4000 != 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
            if (absTick & 0x8000 != 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
            if (absTick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
            if (absTick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
            if (absTick & 0x40000 != 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
            if (absTick & 0x80000 != 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;
            if (tick > 0) ratio = type(uint256).max / ratio;
            sqrtPriceX96 = uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
        }
    }

    /// @dev OpenZeppelin-style full-precision mulDiv (floor).
    function _mulDiv(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
        unchecked {
            uint256 prod0;
            uint256 prod1;
            assembly {
                let mm := mulmod(x, y, not(0))
                prod0 := mul(x, y)
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }
            if (prod1 == 0) return prod0 / denominator;
            require(denominator > prod1, "overflow");
            uint256 remainder;
            assembly {
                remainder := mulmod(x, y, denominator)
                prod1 := sub(prod1, gt(remainder, prod0))
                prod0 := sub(prod0, remainder)
            }
            uint256 twos = denominator & (~denominator + 1);
            assembly {
                denominator := div(denominator, twos)
                prod0 := div(prod0, twos)
                twos := add(div(sub(0, twos), twos), 1)
            }
            prod0 |= prod1 * twos;
            uint256 inverse = (3 * denominator) ^ 2;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            result = prod0 * inverse;
        }
    }
}
