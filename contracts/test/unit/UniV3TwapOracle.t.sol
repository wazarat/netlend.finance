// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {UniV3TwapOracle} from "../../src/oracles/UniV3TwapOracle.sol";
import {MockUSDG} from "../../src/mocks/MockUSDG.sol";
import {MockStockToken} from "../../src/mocks/MockStockToken.sol";

/// @dev Pool stub: constant tick over the window, so the TWAP equals the spot tick.
contract MockPool {
    address public token0;
    address public token1;
    int24 public tick;

    constructor(address a, address b, int24 tick_) {
        (token0, token1) = a < b ? (a, b) : (b, a);
        tick = tick_;
    }

    function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory t, uint160[] memory s) {
        t = new int56[](secondsAgos.length);
        s = new uint160[](secondsAgos.length);
        for (uint256 i = 0; i < secondsAgos.length; i++) {
            // cumulative = tick * (T - secondsAgo); using T = 1e6 for a stable baseline
            t[i] = int56(tick) * int56(uint56(1_000_000 - secondsAgos[i]));
        }
    }
}

contract UniV3TwapOracleTest is Test {
    MockUSDG usdg;
    MockStockToken meme;

    function setUp() public {
        usdg = new MockUSDG(address(this));
        meme = new MockStockToken("Mock PONS", "mPONS", address(this));
    }

    /// At tick 0 the raw pool ratio is 1:1 in base units, so the Morpho price is exactly 1e36.
    function test_tick_zero_price_scaling() public {
        MockPool pool = new MockPool(address(meme), address(usdg), 0);
        UniV3TwapOracle o = new UniV3TwapOracle(address(pool), address(meme), address(usdg), 1800);
        assertEq(o.price(), 1e36);
    }

    /// Tick 6931 ~ price 2.0 (1.0001^6931 ≈ 2.0000). Direction depends on token ordering.
    function test_tick_6931_is_about_two() public {
        MockPool pool = new MockPool(address(meme), address(usdg), 6931);
        UniV3TwapOracle o = new UniV3TwapOracle(address(pool), address(meme), address(usdg), 1800);
        uint256 p = o.price();
        bool memeIsToken0 = address(meme) < address(usdg);
        uint256 expected = memeIsToken0 ? 2e36 : 0.5e36;
        assertApproxEqRel(p, expected, 0.001e18); // 0.1%
    }

    function test_rejects_wrong_tokens() public {
        MockPool pool = new MockPool(address(meme), address(usdg), 0);
        vm.expectRevert(UniV3TwapOracle.TokenNotInPool.selector);
        new UniV3TwapOracle(address(pool), address(meme), address(this), 1800);
    }
}
