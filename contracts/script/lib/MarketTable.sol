// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice The on-chain market table for crednet2 testnet. Mirrors packages/sdk/markets.json (UI registry);
///         keep both in sync. Oracle kinds: 0 = Chainlink-style feed pair, 1 = Uniswap v3 TWAP.
library MarketTable {
    enum OracleKind {
        Feed,
        Twap
    }

    struct Row {
        string key; // "TSLA", "SHORT-ETH" ...
        string collateral; // address-book key suffix: stocks.rTSLA | memes.mPONS | "WETH" | "USDG"
        string loan; // "USDG" | "WETH"
        OracleKind kind;
        string baseFeed; // feed key for collateral (Feed kind) or pool key (Twap kind)
        string quoteFeed; // feed key for loan token
        uint256 lltv; // 1e18
        uint256 cap; // in loan token units (6dp USDG or 18dp WETH)
        string category;
    }

    function rows() internal pure returns (Row[] memory r) {
        r = new Row[](11);
        r[0] = Row("ETH", "WETH", "USDG", OracleKind.Feed, "WETH", "USDG", 0.77e18, 250_000e6, "Crypto");
        r[1] = Row("TSLA", "stocks.rTSLA", "USDG", OracleKind.Feed, "rTSLA", "USDG", 0.625e18, 100_000e6, "Stocks");
        r[2] = Row("NVDA", "stocks.rNVDA", "USDG", OracleKind.Feed, "rNVDA", "USDG", 0.625e18, 100_000e6, "Stocks");
        r[3] = Row("SPY", "stocks.rSPY", "USDG", OracleKind.Feed, "rSPY", "USDG", 0.625e18, 100_000e6, "Stocks");
        r[4] = Row("AAPL", "stocks.rAAPL", "USDG", OracleKind.Feed, "rAAPL", "USDG", 0.625e18, 50_000e6, "Stocks");
        r[5] = Row("SGOV", "stocks.rSGOV", "USDG", OracleKind.Feed, "rSGOV", "USDG", 0.86e18, 100_000e6, "RWA");
        r[6] = Row("GLD", "stocks.rGLD", "USDG", OracleKind.Feed, "rGLD", "USDG", 0.625e18, 50_000e6, "RWA");
        r[7] = Row("PONS", "memes.mPONS", "USDG", OracleKind.Twap, "mPONS-USDG", "", 0.385e18, 25_000e6, "Memes");
        r[8] = Row("CAT", "memes.mCAT", "USDG", OracleKind.Twap, "mCAT-USDG", "", 0.385e18, 10_000e6, "Memes");
        r[9] = Row("SPY-WETH", "stocks.rSPY", "WETH", OracleKind.Feed, "rSPY", "WETH", 0.385e18, 20e18, "Stocks");
        r[10] = Row("SHORT-ETH", "USDG", "WETH", OracleKind.Feed, "USDG", "WETH", 0.625e18, 20e18, "Short");
    }
}
