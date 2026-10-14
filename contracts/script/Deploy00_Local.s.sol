// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AddressBook, console2} from "./lib/AddressBook.sol";
import {MockWETH} from "../src/mocks/MockWETH.sol";

/// @title Deploy00_Local
/// @notice Anvil-only: deploys a WETH9 clone and records it as known.weth so the real scripts can run unchanged.
contract Deploy00_Local is AddressBook {
    function run() external {
        require(block.chainid == 31337, "local rehearsal only");
        address deployer = _deployer();
        vm.startBroadcast(deployer);
        if (_get("known.weth") == address(0)) _put("known.weth", address(new MockWETH()));
        vm.stopBroadcast();
        console2.log("Deploy00_Local done");
    }
}
