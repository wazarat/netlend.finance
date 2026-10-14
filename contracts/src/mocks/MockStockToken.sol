// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title MockStockToken
/// @notice Testnet stand-in for a Robinhood Stock Token (ERC-20, 18 decimals).
///         Mirrors the ERC-8056-style `uiMultiplier()` used for splits/dividends:
///         the raw balance is unchanged, the shares-per-token ratio changes. Mainnet tokens
///         can also pause, block and force-burn; `paused` lets tests exercise that risk.
contract MockStockToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    uint256 private _uiMultiplier = 1e18;
    bool public paused;
    mapping(address => bool) public blocked;

    event UiMultiplierSet(uint256 multiplier);
    event PausedSet(bool paused);
    event BlockedSet(address indexed account, bool blocked);

    constructor(string memory name_, string memory symbol_, address admin) ERC20(name_, symbol_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    /// @dev ERC-8056-style: shares per token, 18 decimals. Default 1e18.
    function uiMultiplier() external view returns (uint256) {
        return _uiMultiplier;
    }

    function setUiMultiplier(uint256 m) external onlyRole(ISSUER_ROLE) {
        require(m > 0, "zero multiplier");
        _uiMultiplier = m;
        emit UiMultiplierSet(m);
    }

    function setPaused(bool p) external onlyRole(ISSUER_ROLE) {
        paused = p;
        emit PausedSet(p);
    }

    function setBlocked(address account, bool b) external onlyRole(ISSUER_ROLE) {
        blocked[account] = b;
        emit BlockedSet(account, b);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!paused, "issuer paused");
        require(!blocked[from] && !blocked[to], "issuer blocked");
        super._update(from, to, value);
    }
}
