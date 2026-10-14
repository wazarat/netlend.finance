// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AddressBook, console2} from "./lib/AddressBook.sol";
import {IPublicAllocatorMin, PAFlowCapsConfig, PAFlowCaps, PA_MAX_SETTABLE_FLOW_CAP} from "./lib/PublicAllocatorTypes.sol";
import {Id} from "morpho-blue/interfaces/IMorpho.sol";

/// @title Deploy05b_FlowCaps
/// @notice Opens the PublicAllocator on every netlend.finance vault. A vault deposit only fills the first market in
///         the supply queue, so without flow caps the other markets have nothing to lend. With maxIn/maxOut set to
///         the maximum on every listed market, anyone (the borrow flow in the web app) can call `reallocateTo` and
///         pull idle liquidity into the market they are about to borrow from, inside the vault's own caps. Fee stays
///         zero. Idempotent: a market whose caps are already open is skipped. Vault lists come from markets.json.
contract Deploy05b_FlowCaps is AddressBook {
    function _registry() internal view returns (string memory) {
        return vm.readFile(string.concat(vm.projectRoot(), "/../packages/sdk/markets.json"));
    }

    function run() external {
        address deployer = _deployer();
        IPublicAllocatorMin pa = IPublicAllocatorMin(_require("core.publicAllocator"));
        string memory reg = _registry();
        string memory book = _readBook();

        vm.startBroadcast(deployer);
        for (uint256 i = 0; vm.keyExistsJson(reg, string.concat(".vaults[", vm.toString(i), "]")); i++) {
            string memory base = string.concat(".vaults[", vm.toString(i), "]");
            string memory key = vm.parseJsonString(reg, string.concat(base, ".key"));
            address vault = _get(string.concat("vaults.", key));
            if (vault == address(0)) {
                console2.log("  vault not deployed, skipping", key);
                continue;
            }
            string[] memory mkeys = vm.parseJsonStringArray(reg, string.concat(base, ".markets"));
            PAFlowCapsConfig[] memory cfg = new PAFlowCapsConfig[](mkeys.length);
            uint256 n;
            for (uint256 j = 0; j < mkeys.length; j++) {
                Id id = Id.wrap(vm.parseJsonBytes32(book, string.concat(".markets.", mkeys[j], ".id")));
                PAFlowCaps memory cur = pa.flowCaps(vault, id);
                if (cur.maxIn == PA_MAX_SETTABLE_FLOW_CAP && cur.maxOut == PA_MAX_SETTABLE_FLOW_CAP) continue;
                cfg[n++] = PAFlowCapsConfig(id, PAFlowCaps(PA_MAX_SETTABLE_FLOW_CAP, PA_MAX_SETTABLE_FLOW_CAP));
            }
            if (n == 0) {
                console2.log("  flow caps already open on", key);
                continue;
            }
            assembly {
                mstore(cfg, n)
            }
            pa.setFlowCaps(vault, cfg);
            console2.log("  flow caps opened on", key, n);
        }
        vm.stopBroadcast();
        console2.log("Deploy05b_FlowCaps done");
    }
}
