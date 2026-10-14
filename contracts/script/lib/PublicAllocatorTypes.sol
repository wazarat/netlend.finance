// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MarketParams, Id} from "morpho-blue/interfaces/IMorpho.sol";

/// @notice ABI-identical view of the Morpho PublicAllocator over this repo's Morpho types. The upstream interface
///         imports its own vendored morpho-blue, whose `Id` and `MarketParams` are distinct Solidity types, so
///         scripts and tests use this copy instead. Layout matches public-allocator/src/interfaces/IPublicAllocator.sol.
struct PAFlowCaps {
    uint128 maxIn;
    uint128 maxOut;
}

struct PAFlowCapsConfig {
    Id id;
    PAFlowCaps caps;
}

struct PAWithdrawal {
    MarketParams marketParams;
    uint128 amount;
}

uint128 constant PA_MAX_SETTABLE_FLOW_CAP = type(uint128).max / 2;

interface IPublicAllocatorMin {
    function admin(address vault) external view returns (address);
    function fee(address vault) external view returns (uint256);
    function flowCaps(address vault, Id id) external view returns (PAFlowCaps memory);
    function setAdmin(address vault, address newAdmin) external;
    function setFee(address vault, uint256 newFee) external;
    function setFlowCaps(address vault, PAFlowCapsConfig[] calldata config) external;
    function reallocateTo(address vault, PAWithdrawal[] calldata withdrawals, MarketParams calldata supplyMarketParams) external payable;
}
