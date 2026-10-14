// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IMetaMorphoV1_1} from "metamorpho/interfaces/IMetaMorphoV1_1.sol";
import {MarketParams, Id} from "morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "morpho-blue/libraries/MarketParamsLib.sol";

/// @title MarketGuard
/// @notice The on-chain half of Longbow's "watchdog": holds the curator role on each netlend.finance vault so a keeper
///         can cap a market to zero the moment an oracle diverges or goes stale. Cap decreases apply instantly in
///         MetaMorpho, so one call stops new allocation. The guard can never raise a cap on its own: increases
///         still go through the human curator (`forwardSubmitCap`) and the vault timelock.
contract MarketGuard {
    using MarketParamsLib for MarketParams;

    address public owner; // human curator / multisig
    mapping(address => bool) public isKeeper;
    mapping(address => mapping(Id => bool)) public tripped; // vault => market => tripped

    event KeeperSet(address indexed keeper, bool allowed);
    event Tripped(address indexed vault, Id indexed market, string reason);
    event Untripped(address indexed vault, Id indexed market);
    event OwnerSet(address indexed owner);

    error NotOwner();
    error NotKeeper();
    error StillTripped();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyKeeperOrOwner() {
        if (msg.sender != owner && !isKeeper[msg.sender]) revert NotKeeper();
        _;
    }

    constructor(address owner_, address[] memory keepers) {
        owner = owner_;
        for (uint256 i = 0; i < keepers.length; i++) {
            isKeeper[keepers[i]] = true;
            emit KeeperSet(keepers[i], true);
        }
    }

    function setOwner(address o) external onlyOwner {
        owner = o;
        emit OwnerSet(o);
    }

    function setKeeper(address k, bool allowed) external onlyOwner {
        isKeeper[k] = allowed;
        emit KeeperSet(k, allowed);
    }

    /// @notice Cap a market to zero on the vault. Keepers call this on divergence/staleness.
    function trip(IMetaMorphoV1_1 vault, MarketParams memory params, string calldata reason) external onlyKeeperOrOwner {
        Id id = params.id();
        tripped[address(vault)][id] = true;
        vault.submitCap(params, 0);
        emit Tripped(address(vault), id, reason);
    }

    /// @notice Owner clears the trip flag; re-listing then goes through forwardSubmitCap + timelock.
    function untrip(address vault, Id id) external onlyOwner {
        tripped[vault][id] = false;
        emit Untripped(vault, id);
    }

    /// @notice Human-curator path for any cap change (increases are timelocked by the vault itself).
    function forwardSubmitCap(IMetaMorphoV1_1 vault, MarketParams memory params, uint256 newCap) external onlyOwner {
        if (newCap > 0 && tripped[address(vault)][params.id()]) revert StillTripped();
        vault.submitCap(params, newCap);
    }

    function forwardSubmitMarketRemoval(IMetaMorphoV1_1 vault, MarketParams memory params) external onlyOwner {
        vault.submitMarketRemoval(params);
    }

    function forwardRevokePendingCap(IMetaMorphoV1_1 vault, Id id) external onlyOwner {
        vault.revokePendingCap(id);
    }
}
