// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

/// @dev Guards the Uniswap deploy path: Foundry must read creation bytecode from the hardhat-format artifacts.
contract VendorArtifactsTest is Test {
    function test_uniswap_artifacts_have_bytecode() public view {
        string[4] memory files = ["UniswapV3Factory", "SwapRouter", "NonfungiblePositionManager", "QuoterV2"];
        for (uint256 i = 0; i < files.length; i++) {
            bytes memory code = vm.getCode(string.concat("vendor/uniswap/", files[i], ".json"));
            assertGt(code.length, 1000, files[i]);
        }
    }

    function test_factory_deploys_locally() public {
        bytes memory init = vm.getCode("vendor/uniswap/UniswapV3Factory.json");
        address addr;
        assembly {
            addr := create(0, add(init, 0x20), mload(init))
        }
        assertTrue(addr != address(0));
        assertGt(addr.code.length, 0);
    }
}
