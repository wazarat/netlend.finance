// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {NetlendToken} from "../../src/token/NetlendToken.sol";
import {StakingRewards} from "../../src/staking/StakingRewards.sol";
import {RevenueSplitter} from "../../src/staking/RevenueSplitter.sol";
import {MockUSDG} from "../../src/mocks/MockUSDG.sol";

contract StakingTest is Test {
    NetlendToken netlend;
    StakingRewards staking;
    RevenueSplitter splitter;
    MockUSDG usdg;
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdg = new MockUSDG(address(this));
        netlend = new NetlendToken(address(this), treasury, 700_000_000e18);
        staking = new StakingRewards(address(this), address(netlend), address(usdg));
        splitter = new RevenueSplitter(address(this), treasury, address(staking), address(usdg), 2_500);
        staking.setRewardsDistribution(address(splitter));
        netlend.mint(alice, 3_000e18);
        netlend.mint(bob, 1_000e18);
        vm.prank(alice);
        netlend.approve(address(staking), type(uint256).max);
        vm.prank(bob);
        netlend.approve(address(staking), type(uint256).max);
    }

    function test_token_is_capped_at_one_billion() public {
        assertEq(netlend.totalSupply(), 700_000_000e18 + 4_000e18);
        vm.expectRevert(NetlendToken.CapExceeded.selector);
        netlend.mint(alice, 300_000_000e18);
        netlend.mint(alice, 300_000_000e18 - 4_000e18);
        assertEq(netlend.totalSupply(), netlend.MAX_SUPPLY());
        assertEq(netlend.symbol(), "NETLEND");
    }

    function test_fee_splits_75_treasury_25_stakers_and_streams_over_a_week() public {
        vm.prank(alice);
        staking.stake(3_000e18);
        vm.prank(bob);
        staking.stake(1_000e18);
        usdg.mint(address(splitter), 10_000e6); // a week of vault performance fees
        splitter.distribute(address(usdg));
        assertEq(usdg.balanceOf(treasury), 7_500e6);
        assertEq(usdg.balanceOf(address(staking)), 2_500e6);
        assertEq(staking.rewardRate(), uint256(2_500e6) / 7 days);

        vm.warp(block.timestamp + 7 days);
        assertApproxEqAbs(staking.earned(alice), 1_875e6, 1e6, "75 % of the stream");
        assertApproxEqAbs(staking.earned(bob), 625e6, 1e6);
        vm.prank(alice);
        staking.exit();
        assertEq(netlend.balanceOf(alice), 3_000e18);
        assertApproxEqAbs(usdg.balanceOf(alice), 1_875e6, 1e6);
    }

    function test_only_distributor_can_notify_and_non_usdg_goes_to_treasury() public {
        vm.expectRevert(StakingRewards.NotDistributor.selector);
        staking.notifyRewardAmount(1);
        NetlendToken other = new NetlendToken(address(this), address(splitter), 1_000e18);
        splitter.distribute(address(other));
        assertEq(other.balanceOf(treasury), 1_000e18);
    }
}
