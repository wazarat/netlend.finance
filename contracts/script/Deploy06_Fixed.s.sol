// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AddressBook, console2} from "./lib/AddressBook.sol";
import {FixedTermMarket, FixedMarketParams, FixedId} from "../src/fixed/FixedTermMarket.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";

/// @title Deploy06_Fixed
/// @notice netlend.finance Fixed: one FixedTermMarket contract, the Morpho LLTV tiers enabled, and one market per row
///         (USDG against a single collateral, reusing the Deploy03 oracle, maturing at 00:00 UTC N days out). Posts a
///         seed lender offer per new market so the Fixed page has something to fill. Idempotent per key.
contract Deploy06_Fixed is AddressBook {
    uint256[] internal LLTVS = [0.385e18, 0.625e18, 0.77e18, 0.86e18, 0.915e18];

    struct Row {
        string key; // fixed.markets.<key>
        string market; // Deploy04 market key: collateral + oracle + lltv come from there
        uint256 termDays;
        uint256 seedPrice; // lender's quote, 1e18 = par
        uint256 seedUsdg; // escrowed principal
    }

    function _rows() internal pure returns (Row[] memory r) {
        r = new Row[](4);
        r[0] = Row("TSLA-30D", "TSLA", 30, 0.99e18, 5_000e6); // ~12.3 % APR
        r[1] = Row("ETH-30D", "ETH", 30, 0.99e18, 10_000e6);
        r[2] = Row("SPY-90D", "SPY", 90, 0.975e18, 5_000e6); // ~10.4 % APR
        r[3] = Row("SGOV-90D", "SGOV", 90, 0.985e18, 5_000e6); // ~6.2 % APR
    }

    /// @dev Next 00:00 UTC that is at least `termDays` away.
    function _maturity(uint256 termDays) internal view returns (uint256) {
        return (block.timestamp / 1 days + termDays + 1) * 1 days;
    }

    function run() external {
        address deployer = _deployer();
        address owner = _role("OWNER", deployer);
        address usdg = _require("substitutes.usdg");
        vm.startBroadcast(deployer);

        address fixedAddr = _get("fixed.market");
        FixedTermMarket fixedMarket;
        if (fixedAddr == address(0)) {
            fixedMarket = new FixedTermMarket(deployer);
            fixedAddr = address(fixedMarket);
            _put("fixed.market", fixedAddr);
        } else {
            fixedMarket = FixedTermMarket(fixedAddr);
        }
        if (fixedMarket.owner() == deployer) {
            for (uint256 i = 0; i < LLTVS.length; i++) {
                if (!fixedMarket.isLltvEnabled(LLTVS[i])) fixedMarket.enableLltv(LLTVS[i]);
            }
        }

        Row[] memory rows = _rows();
        string memory json = _readBook();
        for (uint256 i = 0; i < rows.length; i++) {
            Row memory r = rows[i];
            string memory base = string.concat(".fixed.markets.", r.key);
            if (vm.keyExistsJson(json, string.concat(base, ".id"))) {
                FixedId existing = FixedId.wrap(vm.parseJsonBytes32(json, string.concat(base, ".id")));
                (,,,, bool created) = fixedMarket.market(existing);
                if (created) continue;
            }
            string memory mb = string.concat(".markets.", r.market);
            FixedMarketParams memory p = FixedMarketParams({
                loanToken: usdg,
                collateralToken: vm.parseJsonAddress(json, string.concat(mb, ".collateralToken")),
                oracle: vm.parseJsonAddress(json, string.concat(mb, ".oracle")),
                lltv: vm.parseJsonUint(json, string.concat(mb, ".lltv")),
                maturity: _maturity(r.termDays)
            });
            FixedId mid = fixedMarket.createMarket(p);
            console2.log("created fixed market", r.key);

            MockUSDG(usdg).mint(deployer, r.seedUsdg);
            MockUSDG(usdg).approve(fixedAddr, r.seedUsdg);
            uint256 offerId = fixedMarket.postOffer(mid, r.seedUsdg, r.seedPrice, p.maturity);

            string memory k = string.concat("fixed.markets.", r.key);
            _putString(string.concat(k, ".id"), vm.toString(FixedId.unwrap(mid)));
            _putString(string.concat(k, ".market"), r.market);
            _put(string.concat(k, ".collateralToken"), p.collateralToken);
            _put(string.concat(k, ".oracle"), p.oracle);
            _putUint(string.concat(k, ".lltv"), p.lltv);
            _putUint(string.concat(k, ".maturity"), p.maturity);
            _putUint(string.concat(k, ".seedOffer"), offerId);
            _putUint(string.concat(k, ".seedPrice"), r.seedPrice);
        }

        if (owner != deployer && fixedMarket.owner() == deployer) fixedMarket.setOwner(owner);
        vm.stopBroadcast();
        console2.log("Deploy06_Fixed done. market:", fixedAddr);
    }
}
