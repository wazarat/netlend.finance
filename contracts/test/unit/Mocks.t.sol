// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockUSDG} from "../../src/mocks/MockUSDG.sol";
import {MockStockToken} from "../../src/mocks/MockStockToken.sol";
import {MockV3Aggregator} from "../../src/mocks/MockV3Aggregator.sol";
import {MarketHoursFeed, IAggregatorV3} from "../../src/mocks/MarketHoursFeed.sol";
import {Faucet} from "../../src/mocks/Faucet.sol";

contract MocksTest is Test {
    address admin = address(this);
    address alice = makeAddr("alice");

    MockUSDG usdg;
    MockStockToken tsla;
    MockV3Aggregator raw;
    MarketHoursFeed feed;
    Faucet faucet;

    function setUp() public {
        usdg = new MockUSDG(admin);
        tsla = new MockStockToken("Tesla Stock Token", "rTSLA", admin);
        raw = new MockV3Aggregator(8, "TSLA / USD", 430e8, admin);
        feed = new MarketHoursFeed(IAggregatorV3(address(raw)), admin);
        faucet = new Faucet(admin);
        Faucet.Drip[] memory d = new Faucet.Drip[](2);
        d[0] = Faucet.Drip(address(usdg), 10_000e6);
        d[1] = Faucet.Drip(address(tsla), 10e18);
        faucet.setDrips(d);
        usdg.grantRole(usdg.MINTER_ROLE(), address(faucet));
        tsla.grantRole(tsla.MINTER_ROLE(), address(faucet));
    }

    function test_usdg_has_6_decimals() public view {
        assertEq(usdg.decimals(), 6);
    }

    function test_faucet_claims_once_per_cooldown() public {
        vm.prank(alice);
        faucet.claim();
        assertEq(usdg.balanceOf(alice), 10_000e6);
        assertEq(tsla.balanceOf(alice), 10e18);
        vm.prank(alice);
        vm.expectRevert("cooldown");
        faucet.claim();
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        faucet.claim();
        assertEq(usdg.balanceOf(alice), 20_000e6);
    }

    function test_stock_token_multiplier_and_issuer_powers() public {
        assertEq(tsla.uiMultiplier(), 1e18);
        tsla.setUiMultiplier(2e18);
        assertEq(tsla.uiMultiplier(), 2e18);
        tsla.mint(alice, 1e18);
        tsla.setPaused(true);
        vm.prank(alice);
        vm.expectRevert("issuer paused");
        tsla.transfer(admin, 1);
        tsla.setPaused(false);
        tsla.setBlocked(alice, true);
        vm.prank(alice);
        vm.expectRevert("issuer blocked");
        tsla.transfer(admin, 1);
    }

    function test_market_hours_feed_freezes_when_closed() public {
        (, int256 a0,, uint256 u0,) = feed.latestRoundData();
        assertEq(a0, 430e8);
        feed.setTradingOpen(false);
        vm.warp(block.timestamp + 2 days);
        raw.updateAnswer(300e8);
        (, int256 a1,, uint256 u1,) = feed.latestRoundData();
        assertEq(a1, 430e8);
        assertEq(u1, u0);
        feed.setTradingOpen(true);
        (, int256 a2,, uint256 u2,) = feed.latestRoundData();
        assertEq(a2, 300e8);
        assertGt(u2, u0);
    }

    function test_market_hours_schedule_weekend() public {
        feed.clearOverride();
        vm.warp(1792195200 + 12 hours); // Saturday 2026-10-17
        assertFalse(feed.isOpen());
        vm.warp(1792195200 + 2 days + 12 hours); // Monday 2026-10-19
        assertTrue(feed.isOpen());
    }
}
