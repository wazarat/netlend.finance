// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AddressBook, console2} from "./lib/AddressBook.sol";
import {IMetaMorphoV1_1Factory} from "metamorpho/interfaces/IMetaMorphoV1_1Factory.sol";
import {IMetaMorphoV1_1} from "metamorpho/interfaces/IMetaMorphoV1_1.sol";
import {MarketParams, Id} from "morpho-blue/interfaces/IMorpho.sol";
import {MarketParamsLib} from "morpho-blue/libraries/MarketParamsLib.sol";
import {MarketGuard} from "../src/guard/MarketGuard.sol";

/// @title Deploy05_Vaults
/// @notice Three curated ERC-4626 vaults (MetaMorpho v1.1): USDG Core (feed-priced collateral only),
///         USDG Frontier (long-tail + ETH), ETH (WETH loan markets). Created with timelock 0 so caps apply at once,
///         then the 1-day timelock is submitted. Curator = MarketGuard (watchdog can cap to zero), allocator =
///         ALLOCATOR + PublicAllocator, guardian = SENTINEL, fee 10% to FEE_RECIPIENT.
contract Deploy05_Vaults is AddressBook {
    using MarketParamsLib for MarketParams;

    uint256 constant FEE = 0.1e18;

    struct Roles {
        address deployer;
        address owner;
        address allocator;
        address sentinel;
        address feeRecipient;
        address publicAllocator;
        address guard;
    }

    struct VaultDef {
        string key;
        string name;
        string symbol;
        address asset;
        string[] markets;
    }

    function _defs(address usdg, address weth) internal pure returns (VaultDef[] memory v) {
        v = new VaultDef[](3);
        string[] memory core = new string[](7);
        core[0] = "ETH"; core[1] = "TSLA"; core[2] = "NVDA"; core[3] = "SPY"; core[4] = "AAPL"; core[5] = "SGOV"; core[6] = "GLD";
        v[0] = VaultDef("core", "netlend USDG Core", "nlUSDG", usdg, core);
        string[] memory frontier = new string[](3);
        frontier[0] = "PONS"; frontier[1] = "CAT"; frontier[2] = "ETH";
        v[1] = VaultDef("frontier", "netlend USDG Frontier", "nlUSDGf", usdg, frontier);
        string[] memory eth = new string[](2);
        eth[0] = "SPY-WETH"; eth[1] = "SHORT-ETH";
        v[2] = VaultDef("eth", "netlend ETH", "nlETH", weth, eth);
    }

    function _params(string memory key) internal view returns (MarketParams memory p, uint256 cap) {
        string memory b = string.concat(".markets.", key);
        string memory json = _readBook();
        p = MarketParams({
            loanToken: vm.parseJsonAddress(json, string.concat(b, ".loanToken")),
            collateralToken: vm.parseJsonAddress(json, string.concat(b, ".collateralToken")),
            oracle: vm.parseJsonAddress(json, string.concat(b, ".oracle")),
            irm: vm.parseJsonAddress(json, string.concat(b, ".irm")),
            lltv: vm.parseJsonUint(json, string.concat(b, ".lltv"))
        });
        cap = vm.parseJsonUint(json, string.concat(b, ".cap"));
    }

    function _setCaps(IMetaMorphoV1_1 vault, string[] memory markets) internal returns (Id[] memory queue) {
        queue = new Id[](markets.length);
        for (uint256 j = 0; j < markets.length; j++) {
            (MarketParams memory p, uint256 cap) = _params(markets[j]);
            vault.submitCap(p, cap); // instant while timelock == 0
            vault.acceptCap(p);
            queue[j] = p.id();
        }
    }

    function _deployVault(IMetaMorphoV1_1Factory factory, Roles memory r, VaultDef memory d) internal {
        string memory vk = string.concat("vaults.", d.key);
        if (_get(vk) != address(0)) return;
        IMetaMorphoV1_1 vault = factory.createMetaMorpho(r.deployer, 0, d.asset, d.name, d.symbol, keccak256(bytes(d.key)));
        _put(vk, address(vault));

        vault.setCurator(r.deployer);
        Id[] memory queue = _setCaps(vault, d.markets);
        vault.setIsAllocator(r.allocator, true);
        vault.setIsAllocator(r.publicAllocator, true);
        vault.setSupplyQueue(queue);
        vault.setFeeRecipient(r.feeRecipient);
        vault.setFee(FEE);

        vault.setCurator(r.guard); // watchdog can now cap to zero
        vault.submitGuardian(r.sentinel); // no guardian yet → applies immediately
        vault.submitTimelock(1 days); // increase → applies immediately
        if (r.owner != r.deployer) vault.transferOwnership(r.owner);
    }

    function run() external {
        Roles memory r;
        r.deployer = _deployer();
        r.owner = _role("OWNER", r.deployer);
        r.allocator = _role("ALLOCATOR", r.deployer);
        r.sentinel = _role("SENTINEL", r.deployer);
        r.feeRecipient = _role("FEE_RECIPIENT", r.deployer);
        r.publicAllocator = _require("core.publicAllocator");
        IMetaMorphoV1_1Factory factory = IMetaMorphoV1_1Factory(_require("core.metaMorphoFactory"));
        VaultDef[] memory defs = _defs(_require("substitutes.usdg"), _require("known.weth"));

        vm.startBroadcast(r.deployer);

        r.guard = _get("vaults.marketGuard");
        if (r.guard == address(0)) {
            address[] memory keepers = new address[](1);
            keepers[0] = _role("WATCHDOG_KEEPER", r.deployer);
            r.guard = address(new MarketGuard(r.owner, keepers));
            _put("vaults.marketGuard", r.guard);
        }
        for (uint256 i = 0; i < defs.length; i++) {
            _deployVault(factory, r, defs[i]);
        }

        vm.stopBroadcast();
        console2.log("Deploy05_Vaults done");
    }
}
