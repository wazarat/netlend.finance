// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AddressBook, console2} from "./lib/AddressBook.sol";
import {MarketTable} from "./lib/MarketTable.sol";
import {IMorpho, MarketParams, Id} from "morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "morpho-blue/libraries/MarketParamsLib.sol";

/// @title Deploy04_Markets
/// @notice Creates the isolated, immutable Morpho markets listed in MarketTable. Each market = one collateral,
///         one loan token, one oracle, the adaptive-curve IRM and one LLTV. Writes markets.<KEY>.id and the
///         params the UI needs. Re-running skips markets that already exist on-chain.
contract Deploy04_Markets is AddressBook {
    using MarketParamsLib for MarketParams;

    function _token(string memory key) internal view returns (address) {
        bytes32 h = keccak256(bytes(key));
        if (h == keccak256("WETH")) return _require("known.weth");
        if (h == keccak256("USDG")) return _require("substitutes.usdg");
        return _require(string.concat("substitutes.", key));
    }

    function run() external {
        address deployer = _deployer();
        IMorpho morpho = IMorpho(_require("core.morpho"));
        address irm = _require("core.adaptiveCurveIrm");
        vm.startBroadcast(deployer);

        MarketTable.Row[] memory rows = MarketTable.rows();
        for (uint256 i = 0; i < rows.length; i++) {
            MarketTable.Row memory r = rows[i];
            MarketParams memory p = MarketParams({
                loanToken: _token(r.loan),
                collateralToken: _token(r.collateral),
                oracle: _require(string.concat("oracles.", r.key)),
                irm: irm,
                lltv: r.lltv
            });
            Id id = p.id();
            uint128 lastUpdate = morpho.market(id).lastUpdate;
            if (lastUpdate == 0) {
                morpho.createMarket(p);
                console2.log("created market", r.key);
            }
            string memory base = string.concat("markets.", r.key);
            _putString(string.concat(base, ".id"), vm.toString(Id.unwrap(id)));
            _put(string.concat(base, ".loanToken"), p.loanToken);
            _put(string.concat(base, ".collateralToken"), p.collateralToken);
            _put(string.concat(base, ".oracle"), p.oracle);
            _put(string.concat(base, ".irm"), p.irm);
            _putUint(string.concat(base, ".lltv"), p.lltv);
            _putUint(string.concat(base, ".cap"), r.cap);
            _putString(string.concat(base, ".category"), r.category);
        }

        vm.stopBroadcast();
        console2.log("Deploy04_Markets done");
    }
}
