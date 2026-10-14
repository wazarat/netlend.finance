// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title NetlendToken (NETLEND)
/// @notice Testnet stand-in for the netlend.finance protocol token so Stake can be exercised on 46630 before the
///         canhav curve launch mints the canonical token. Hard cap 1,000,000,000; the constructor mints the
///         non-public share (team, investors, advisors, treasury, liquidity, rewards) to the treasury wallet and
///         MINTER_ROLE (deployer + faucet) can mint the rest, which stands in for the 30 % public curve sale.
///         Utility is one thing only: stake it in StakingRewards and receive USDG from borrower interest.
contract NetlendToken is ERC20, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_SUPPLY = 1_000_000_000e18;

    error CapExceeded();

    constructor(address admin, address treasury, uint256 initialMint) ERC20("netlend", "NETLEND") ERC20Permit("netlend") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        if (initialMint > MAX_SUPPLY) revert CapExceeded();
        _mint(treasury, initialMint);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (totalSupply() + amount > MAX_SUPPLY) revert CapExceeded();
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
