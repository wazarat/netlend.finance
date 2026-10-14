// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Vm} from "forge-std/Vm.sol";

/// @notice Deploys upstream Morpho contracts from their compiled artifacts (see src/anchors). Keeps scripts and
///         tests on one compiler version while the upstream sources keep their pinned pragmas.
library Upstream {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function deploy(string memory artifact, bytes memory args) internal returns (address addr) {
        bytes memory init = abi.encodePacked(vm.getCode(artifact), args);
        assembly {
            addr := create(0, add(init, 0x20), mload(init))
        }
        require(addr != address(0), string.concat("deploy failed: ", artifact));
    }

    function morpho(address owner) internal returns (address) {
        return deploy("Morpho.sol:Morpho", abi.encode(owner));
    }

    function adaptiveCurveIrm(address morpho_) internal returns (address) {
        return deploy("AdaptiveCurveIrm.sol:AdaptiveCurveIrm", abi.encode(morpho_));
    }

    function chainlinkOracleV2Factory() internal returns (address) {
        return deploy("MorphoChainlinkOracleV2Factory.sol:MorphoChainlinkOracleV2Factory", "");
    }

    function metaMorphoFactory(address morpho_) internal returns (address) {
        return deploy("MetaMorphoV1_1Factory.sol:MetaMorphoV1_1Factory", abi.encode(morpho_));
    }

    function publicAllocator(address morpho_) internal returns (address) {
        return deploy("PublicAllocator.sol:PublicAllocator", abi.encode(morpho_));
    }

    function bundler3() internal returns (address) {
        return deploy("Bundler3.sol:Bundler3", "");
    }

    function generalAdapter1(address bundler3_, address morpho_, address wNative) internal returns (address) {
        return deploy("GeneralAdapter1.sol:GeneralAdapter1", abi.encode(bundler3_, morpho_, wNative));
    }
}
