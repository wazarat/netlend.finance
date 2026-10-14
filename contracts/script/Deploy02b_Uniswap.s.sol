// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AddressBook, console2} from "./lib/AddressBook.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";

interface IUniV3FactoryMin {
    function createPool(address a, address b, uint24 fee) external returns (address);
    function getPool(address a, address b, uint24 fee) external view returns (address);
}

interface IUniV3PoolMin {
    function initialize(uint160 sqrtPriceX96) external;
    function increaseObservationCardinalityNext(uint16 n) external;
    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool);
}

interface INPMMin {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    function mint(MintParams calldata p) external payable returns (uint256, uint128, uint256, uint256);
}

interface IWETHMin {
    function deposit() external payable;
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/// @title Deploy02b_Uniswap
/// @notice Minimal Uniswap v3 on Robinhood testnet from the official npm artifacts (bytecode unchanged):
///         factory, SwapRouter, NonfungiblePositionManager (no descriptor), QuoterV2. Seeds full-range
///         liquidity in USDG pools for each mock stock, each meme token and WETH so Multiply swaps and
///         TWAP oracles have depth. Idempotent.
contract Deploy02b_Uniswap is AddressBook {
    uint24 constant FEE = 3000;
    int24 constant TICK_LOWER = -887220; // full range, multiple of spacing 60
    int24 constant TICK_UPPER = 887220;

    function _deployArtifact(string memory file, bytes memory args) internal returns (address addr) {
        bytes memory code = vm.getCode(string.concat("vendor/uniswap/", file, ".json"));
        bytes memory init = abi.encodePacked(code, args);
        assembly {
            addr := create(0, add(init, 0x20), mload(init))
        }
        require(addr != address(0), string.concat("deploy failed: ", file));
    }

    /// @dev sqrt(amount1/amount0) * 2^96 with enough precision for testnet seeding.
    function _sqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        uint256 ratioX96 = (amount1 << 96) / amount0;
        uint256 s = _sqrt(ratioX96); // = sqrt(amount1/amount0) * 2^48
        return uint160(s << 48);
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function _seed(address npm, address factory, address tokenA, uint256 amountA, address tokenB, uint256 amountB)
        internal
        returns (address pool)
    {
        (address t0, address t1, uint256 a0, uint256 a1) =
            tokenA < tokenB ? (tokenA, tokenB, amountA, amountB) : (tokenB, tokenA, amountB, amountA);
        pool = IUniV3FactoryMin(factory).getPool(t0, t1, FEE);
        if (pool == address(0)) {
            pool = IUniV3FactoryMin(factory).createPool(t0, t1, FEE);
            IUniV3PoolMin(pool).initialize(_sqrtPriceX96(a0, a1));
            IUniV3PoolMin(pool).increaseObservationCardinalityNext(120);
            IERC20(t0).approve(npm, a0);
            IERC20(t1).approve(npm, a1);
            INPMMin(npm).mint(
                INPMMin.MintParams(t0, t1, FEE, TICK_LOWER, TICK_UPPER, a0, a1, 0, 0, msg.sender, block.timestamp + 1 hours)
            );
        }
    }

    struct Ctx {
        address deployer;
        address weth;
        address usdg;
        address factory;
        address npm;
    }

    function _deployCore(Ctx memory c) internal {
        c.factory = _get("uniswap.factory");
        if (c.factory == address(0)) {
            c.factory = _deployArtifact("UniswapV3Factory", "");
            _put("uniswap.factory", c.factory);
        }
        if (_get("uniswap.swapRouter") == address(0)) {
            _put("uniswap.swapRouter", _deployArtifact("SwapRouter", abi.encode(c.factory, c.weth)));
        }
        c.npm = _get("uniswap.positionManager");
        if (c.npm == address(0)) {
            c.npm = _deployArtifact("NonfungiblePositionManager", abi.encode(c.factory, c.weth, address(0)));
            _put("uniswap.positionManager", c.npm);
        }
        if (_get("uniswap.quoterV2") == address(0)) {
            _put("uniswap.quoterV2", _deployArtifact("QuoterV2", abi.encode(c.factory, c.weth)));
        }
    }

    /// @dev Mints `amountTok` of `tokenKey` and the matching USDG, seeds a full-range pool, records it.
    function _seedUsdgPool(Ctx memory c, string memory tokenKey, string memory symbol, uint256 amountTok, uint256 amountUsdg)
        internal
    {
        string memory poolKey = string.concat("uniswap.pools.", symbol, "-USDG");
        if (_get(poolKey) != address(0)) return;
        address tok = _require(tokenKey);
        MockStockToken(tok).mint(c.deployer, amountTok);
        MockUSDG(c.usdg).mint(c.deployer, amountUsdg);
        _put(poolKey, _seed(c.npm, c.factory, tok, amountTok, c.usdg, amountUsdg));
    }

    function _seedWethPool(Ctx memory c) internal {
        if (_get("uniswap.pools.WETH-USDG") != address(0)) return;
        // Needs testnet ETH on the deployer: wraps 0.5 ETH against 1,220 USDG (ETH = 2,440).
        uint256 ethAmt = 0.5 ether;
        require(c.deployer.balance > ethAmt + 0.05 ether, "fund deployer with >0.55 testnet ETH");
        IWETHMin(c.weth).deposit{value: ethAmt}();
        uint256 usdgAmt = 1_220e6;
        MockUSDG(c.usdg).mint(c.deployer, usdgAmt);
        _put("uniswap.pools.WETH-USDG", _seed(c.npm, c.factory, c.weth, ethAmt, c.usdg, usdgAmt));
    }

    function run() external {
        Ctx memory c;
        c.deployer = _deployer();
        c.weth = _require("known.weth");
        c.usdg = _require("substitutes.usdg");
        vm.startBroadcast(c.deployer);

        _deployCore(c);

        // Stock pools follow Deploy02's feed prices; memes get thin, small-cap pools by design.
        string[6] memory stocks = ["rTSLA", "rNVDA", "rSPY", "rAAPL", "rSGOV", "rGLD"];
        uint256[6] memory px = [uint256(430), 185, 660, 255, 100, 370]; // USDG per token
        for (uint256 i = 0; i < stocks.length; i++) {
            _seedUsdgPool(c, string.concat("substitutes.stocks.", stocks[i]), stocks[i], 2_000e18, 2_000 * px[i] * 1e6);
        }
        string[2] memory memes = ["mPONS", "mCAT"];
        uint256[2] memory memePx6 = [uint256(50_000), 2_000]; // USDG (6dp) per 1e18 token: 0.05 and 0.002
        for (uint256 i = 0; i < memes.length; i++) {
            _seedUsdgPool(c, string.concat("substitutes.memes.", memes[i]), memes[i], 10_000_000e18, 10_000_000 * memePx6[i]);
        }
        _seedWethPool(c);

        vm.stopBroadcast();
        console2.log("Deploy02b_Uniswap done. factory:", c.factory);
    }
}
