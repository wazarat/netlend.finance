// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AddressBook, console2} from "./lib/AddressBook.sol";
import {MarketTable} from "./lib/MarketTable.sol";
import {MorphoChainlinkOracleV2Factory} from "morpho-blue-oracles/morpho-chainlink/MorphoChainlinkOracleV2Factory.sol";
import {UniV3TwapOracleFactory} from "../src/oracles/UniV3TwapOracleFactory.sol";

interface IDecimals {
    function decimals() external view returns (uint8);
}

/// @title Deploy03_Oracles
/// @notice One Morpho oracle per market row. Feed markets use the upstream MorphoChainlinkOracleV2 factory
///         (base = collateral feed, quote = loan feed; Short ETH is simply USDG/USD over ETH/USD). Long-tail
///         markets use our 30-minute Uniswap v3 TWAP oracle. Writes oracles.<KEY>.
contract Deploy03_Oracles is AddressBook {
    uint32 constant TWAP_WINDOW = 1800;

    function _token(string memory key) internal view returns (address) {
        bytes32 h = keccak256(bytes(key));
        if (h == keccak256("WETH")) return _require("known.weth");
        if (h == keccak256("USDG")) return _require("substitutes.usdg");
        return _require(string.concat("substitutes.", key));
    }

    /// @dev Calldata is assembled in two halves to stay under the EVM stack limit (11 static args).
    function _feedOracle(MorphoChainlinkOracleV2Factory f, MarketTable.Row memory r, address coll, address loan)
        internal
        returns (address oracle)
    {
        bytes memory head = abi.encode(
            address(0), uint256(1), _require(string.concat("substitutes.feeds.", r.baseFeed)), address(0), uint256(IDecimals(coll).decimals())
        );
        bytes memory tail = abi.encode(
            address(0), uint256(1), _require(string.concat("substitutes.feeds.", r.quoteFeed)), address(0), uint256(IDecimals(loan).decimals()), keccak256(bytes(r.key))
        );
        (bool ok, bytes memory ret) =
            address(f).call(abi.encodePacked(f.createMorphoChainlinkOracleV2.selector, head, tail));
        require(ok, "oracle factory call failed");
        oracle = abi.decode(ret, (address));
    }

    function _twapOracle(address f, MarketTable.Row memory r, address coll, address loan) internal returns (address) {
        address pool = _require(string.concat("uniswap.pools.", r.baseFeed));
        return address(UniV3TwapOracleFactory(f).create(pool, coll, loan, TWAP_WINDOW, keccak256(bytes(r.key))));
    }

    function run() external {
        address deployer = _deployer();
        MorphoChainlinkOracleV2Factory clFactory = MorphoChainlinkOracleV2Factory(_require("core.chainlinkOracleV2Factory"));
        vm.startBroadcast(deployer);

        address twapFactory = _get("oracles.twapFactory");
        if (twapFactory == address(0)) {
            twapFactory = address(new UniV3TwapOracleFactory());
            _put("oracles.twapFactory", twapFactory);
        }

        MarketTable.Row[] memory rows = MarketTable.rows();
        for (uint256 i = 0; i < rows.length; i++) {
            MarketTable.Row memory r = rows[i];
            string memory key = string.concat("oracles.", r.key);
            if (_get(key) != address(0)) continue;
            address coll = _token(r.collateral);
            address loan = _token(r.loan);
            address oracle = r.kind == MarketTable.OracleKind.Feed
                ? _feedOracle(clFactory, r, coll, loan)
                : _twapOracle(twapFactory, r, coll, loan);
            _put(key, oracle);
        }

        vm.stopBroadcast();
        console2.log("Deploy03_Oracles done");
    }
}
