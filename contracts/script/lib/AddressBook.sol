// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

/// @notice Shared plumbing for deploy scripts: reads/writes packages/sdk/addresses.46630.json
///         so web/api/mcp consume one source of truth. Keys are dotted paths (e.g. "core.morpho").
abstract contract AddressBook is Script {
    using stdJson for string;

    string internal constant BOOK = "../packages/sdk/addresses.46630.json";

    /// @dev Override with ADDRESS_BOOK=../packages/sdk/addresses.local.json for Anvil rehearsals.
    function _bookPath() internal view returns (string memory) {
        return string.concat(vm.projectRoot(), "/", vm.envOr("ADDRESS_BOOK", BOOK));
    }

    function _readBook() internal view returns (string memory) {
        return vm.readFile(_bookPath());
    }

    function _get(string memory key) internal view returns (address) {
        string memory json = _readBook();
        string memory path = string.concat(".", key);
        if (!vm.keyExistsJson(json, path)) return address(0);
        bytes memory raw = json.parseRaw(path);
        if (raw.length == 0) return address(0);
        address a = abi.decode(raw, (address));
        // The book is written during simulation; if a broadcast failed the address has no code on this chain,
        // so treat it as absent and redeploy (CREATE addresses are nonce-deterministic, so a success matches).
        if (a != address(0) && a.code.length == 0) return address(0);
        return a;
    }

    function _require(string memory key) internal view returns (address a) {
        a = _get(key);
        require(a != address(0), string.concat("addresses.46630.json missing ", key));
    }

    /// @dev Writes a single address under a dotted key (parent object must exist).
    function _put(string memory key, address value) internal {
        vm.writeJson(vm.toString(value), _bookPath(), string.concat(".", key));
        console2.log(string.concat("  ", key, " = "), value);
    }

    function _putString(string memory key, string memory value) internal {
        vm.writeJson(value, _bookPath(), string.concat(".", key));
    }

    function _putUint(string memory key, uint256 value) internal {
        vm.writeJson(vm.toString(value), _bookPath(), string.concat(".", key));
    }

    /// @dev Role addresses default to the deployer on testnet when env vars are unset.
    function _role(string memory name, address deployer) internal view returns (address) {
        return vm.envOr(name, deployer);
    }

    function _deployer() internal returns (address) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        return vm.rememberKey(pk);
    }
}
