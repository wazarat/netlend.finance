// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AddressBook, console2} from "./lib/AddressBook.sol";
import {Upstream} from "./lib/Upstream.sol";
import {IMorpho} from "morpho-blue/interfaces/IMorpho.sol";

/// @title Deploy01_Core
/// @notice Morpho Blue settlement layer for netlend.finance on Robinhood testnet (unmodified GPL-2.0 upstream bytecode):
///         Morpho, AdaptiveCurveIRM, ChainlinkOracleV2 factory, MetaMorpho v1.1 factory, PublicAllocator.
///         Enables the LLTV tiers Longbow uses (38.5 / 62.5 / 77 / 86 / 91.5 %) and sets the fee recipient.
///         Skips any component already recorded in addresses.46630.json (re-runnable).
contract Deploy01_Core is AddressBook {
    uint256[] internal LLTVS = [0.385e18, 0.625e18, 0.77e18, 0.86e18, 0.915e18];

    function run() external {
        address deployer = _deployer();
        address owner = _role("OWNER", deployer);
        address feeRecipient = _role("FEE_RECIPIENT", deployer);

        vm.startBroadcast(deployer);

        address morpho = _get("core.morpho");
        if (morpho == address(0)) {
            morpho = Upstream.morpho(deployer); // deployer configures, then hands over to OWNER
            _put("core.morpho", morpho);
        }
        address irm = _get("core.adaptiveCurveIrm");
        if (irm == address(0)) {
            irm = Upstream.adaptiveCurveIrm(morpho);
            _put("core.adaptiveCurveIrm", irm);
        }
        if (_get("core.chainlinkOracleV2Factory") == address(0)) {
            _put("core.chainlinkOracleV2Factory", Upstream.chainlinkOracleV2Factory());
        }
        if (_get("core.metaMorphoFactory") == address(0)) {
            _put("core.metaMorphoFactory", Upstream.metaMorphoFactory(morpho));
        }
        if (_get("core.publicAllocator") == address(0)) {
            _put("core.publicAllocator", Upstream.publicAllocator(morpho));
        }

        IMorpho m = IMorpho(morpho);
        if (m.owner() == deployer) {
            if (!m.isIrmEnabled(irm)) m.enableIrm(irm);
            for (uint256 i = 0; i < LLTVS.length; i++) {
                if (!m.isLltvEnabled(LLTVS[i])) m.enableLltv(LLTVS[i]);
            }
            if (m.feeRecipient() != feeRecipient) m.setFeeRecipient(feeRecipient);
            if (owner != deployer) m.setOwner(owner);
        }

        vm.stopBroadcast();
        _putUint("core.chainId", block.chainid);
        console2.log("Deploy01_Core done. morpho:", morpho);
    }
}
