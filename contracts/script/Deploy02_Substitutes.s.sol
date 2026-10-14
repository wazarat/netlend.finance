// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AddressBook, console2} from "./lib/AddressBook.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";
import {MockV3Aggregator} from "../src/mocks/MockV3Aggregator.sol";
import {MarketHoursFeed, IAggregatorV3} from "../src/mocks/MarketHoursFeed.sol";
import {Faucet} from "../src/mocks/Faucet.sol";
import {MockNFT} from "../src/mocks/MockNFT.sol";

/// @title Deploy02_Substitutes
/// @notice Testnet stand-ins for what Robinhood testnet lacks: USDG, Stock Tokens, Chainlink 24/5 feeds,
///         long-tail tokens, NFT collections, plus a faucet. Idempotent per key.
contract Deploy02_Substitutes is AddressBook {
    struct Stock {
        string symbol;
        string name;
        int256 priceUsd8; // 8 decimals
        bool equity; // equity feeds get a MarketHoursFeed wrapper (24/5)
    }

    function _stocks() internal pure returns (Stock[] memory s) {
        s = new Stock[](7);
        s[0] = Stock("rTSLA", "Tesla Stock Token", 430_00000000, true);
        s[1] = Stock("rNVDA", "NVIDIA Stock Token", 185_00000000, true);
        s[2] = Stock("rSPY", "SPDR S&P 500 Token", 660_00000000, true);
        s[3] = Stock("rAAPL", "Apple Stock Token", 255_00000000, true);
        s[4] = Stock("rSGOV", "iShares 0-3M Treasury Token", 100_50000000, true);
        s[5] = Stock("rGLD", "SPDR Gold Token", 370_00000000, true);
        s[6] = Stock("WETH", "", 2440_00000000, false); // feed only; token is the chain's WETH
    }

    function run() external {
        address deployer = _deployer();
        vm.startBroadcast(deployer);

        address usdg = _get("substitutes.usdg");
        if (usdg == address(0)) {
            usdg = address(new MockUSDG(deployer));
            _put("substitutes.usdg", usdg);
        }
        if (_get("substitutes.feeds.USDG") == address(0)) {
            _put("substitutes.feeds.USDG", address(new MockV3Aggregator(8, "USDG / USD", 1_00000000, deployer)));
        }

        Stock[] memory stocks = _stocks();
        for (uint256 i = 0; i < stocks.length; i++) {
            Stock memory st = stocks[i];
            if (st.equity) {
                string memory tokenKey = string.concat("substitutes.stocks.", st.symbol);
                if (_get(tokenKey) == address(0)) {
                    _put(tokenKey, address(new MockStockToken(st.name, st.symbol, deployer)));
                }
            }
            string memory rawKey = string.concat("substitutes.rawFeeds.", st.symbol);
            address raw = _get(rawKey);
            if (raw == address(0)) {
                raw = address(new MockV3Aggregator(8, string.concat(st.symbol, " / USD"), st.priceUsd8, deployer));
                _put(rawKey, raw);
            }
            string memory feedKey = string.concat("substitutes.feeds.", st.symbol);
            if (_get(feedKey) == address(0)) {
                address feed = st.equity ? address(new MarketHoursFeed(IAggregatorV3(raw), deployer)) : raw;
                _put(feedKey, feed);
            }
        }

        string[2] memory memes = ["mPONS", "mCAT"];
        for (uint256 i = 0; i < memes.length; i++) {
            string memory key = string.concat("substitutes.memes.", memes[i]);
            if (_get(key) == address(0)) {
                _put(key, address(new MockStockToken(string.concat("Mock ", memes[i]), memes[i], deployer)));
            }
        }

        if (_get("substitutes.nfts.punks") == address(0)) {
            _put("substitutes.nfts.punks", address(new MockNFT("Mock Robinhood Punks", "mPUNK", 10_000, "ipfs://punks/")));
        }
        if (_get("substitutes.nfts.stonkbrokers") == address(0)) {
            _put("substitutes.nfts.stonkbrokers", address(new MockNFT("Mock StonkBrokers", "mSTONK", 4_444, "ipfs://stonk/")));
        }

        address faucet = _get("substitutes.faucet");
        if (faucet == address(0)) {
            Faucet f = new Faucet(deployer);
            faucet = address(f);
            _put("substitutes.faucet", faucet);
            Faucet.Drip[] memory drips = new Faucet.Drip[](1 + 6 + 2);
            drips[0] = Faucet.Drip(usdg, 10_000e6);
            uint256 n = 1;
            for (uint256 i = 0; i < stocks.length; i++) {
                if (!stocks[i].equity) continue;
                drips[n++] = Faucet.Drip(_get(string.concat("substitutes.stocks.", stocks[i].symbol)), 10e18);
            }
            for (uint256 i = 0; i < memes.length; i++) {
                drips[n++] = Faucet.Drip(_get(string.concat("substitutes.memes.", memes[i])), 100_000e18);
            }
            f.setDrips(drips);
            MockUSDG(usdg).grantRole(MockUSDG(usdg).MINTER_ROLE(), faucet);
            for (uint256 i = 1; i < drips.length; i++) {
                MockStockToken t = MockStockToken(drips[i].token);
                t.grantRole(t.MINTER_ROLE(), faucet);
            }
        }

        vm.stopBroadcast();
        console2.log("Deploy02_Substitutes done. usdg:", usdg, "faucet:", faucet);
    }
}
