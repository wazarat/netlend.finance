// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IStakingRewardsMin {
    function notifyRewardAmount(uint256 reward) external;
}

/// @title RevenueSplitter
/// @notice Fee recipient of every netlend.finance vault. Holds the 10 % performance fee (USDG or WETH) and, when
///         `distribute` is called for a token, sends `stakersBps` of it to the StakingRewards stream and the rest to
///         the treasury. Longbow's split of borrower interest is vault 80 / treasury 15 / stakers 5; the vault share
///         never reaches this contract, so the fee itself splits 75 / 25.
contract RevenueSplitter {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;

    address public owner;
    address public treasury;
    IStakingRewardsMin public staking;
    IERC20 public immutable stakersToken; // the only token the staking stream pays (USDG)
    uint256 public stakersBps;

    event Distributed(address indexed token, uint256 toStakers, uint256 toTreasury);
    event ConfigSet(address treasury, address staking, uint256 stakersBps);
    event OwnerSet(address indexed owner);

    error NotOwner();
    error BadBps();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address owner_, address treasury_, address staking_, address stakersToken_, uint256 stakersBps_) {
        if (owner_ == address(0) || treasury_ == address(0) || stakersToken_ == address(0)) revert ZeroAddress();
        if (stakersBps_ > BPS) revert BadBps();
        owner = owner_;
        treasury = treasury_;
        staking = IStakingRewardsMin(staking_);
        stakersToken = IERC20(stakersToken_);
        stakersBps = stakersBps_;
        emit OwnerSet(owner_);
        emit ConfigSet(treasury_, staking_, stakersBps_);
    }

    /// @notice Split the balance of `token`. Only the stakers token feeds the stream; other tokens go to treasury.
    function distribute(address token) external returns (uint256 toStakers, uint256 toTreasury) {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (token == address(stakersToken) && address(staking) != address(0)) {
            toStakers = bal * stakersBps / BPS;
        }
        toTreasury = bal - toStakers;
        if (toStakers > 0) {
            IERC20(token).forceApprove(address(staking), toStakers);
            staking.notifyRewardAmount(toStakers);
        }
        if (toTreasury > 0) IERC20(token).safeTransfer(treasury, toTreasury);
        emit Distributed(token, toStakers, toTreasury);
    }

    function setConfig(address treasury_, address staking_, uint256 stakersBps_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        if (stakersBps_ > BPS) revert BadBps();
        treasury = treasury_;
        staking = IStakingRewardsMin(staking_);
        stakersBps = stakersBps_;
        emit ConfigSet(treasury_, staking_, stakersBps_);
    }

    function setOwner(address o) external onlyOwner {
        if (o == address(0)) revert ZeroAddress();
        owner = o;
        emit OwnerSet(o);
    }
}
