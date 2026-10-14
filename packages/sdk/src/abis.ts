import { parseAbi } from "viem";
import IMorphoJson from "../abis/IMorpho.json" with { type: "json" };
import IMetaMorphoJson from "../abis/IMetaMorpho.json" with { type: "json" };
import IIrmJson from "../abis/IIrm.json" with { type: "json" };
import IOracleJson from "../abis/IOracle.json" with { type: "json" };
import FaucetJson from "../abis/Faucet.json" with { type: "json" };
import IPublicAllocatorJson from "../abis/IPublicAllocator.json" with { type: "json" };
import MarketGuardJson from "../abis/MarketGuard.json" with { type: "json" };

/** Full ABIs exported by scripts/export-abis.sh (used by the server-side readers). */
export const IMorpho = IMorphoJson as readonly unknown[];
export const IMetaMorpho = IMetaMorphoJson as readonly unknown[];
export const IIrm = IIrmJson as readonly unknown[];
export const IOracle = IOracleJson as readonly unknown[];
export const Faucet = FaucetJson as readonly unknown[];
export const IPublicAllocator = IPublicAllocatorJson as readonly unknown[];
export const MarketGuard = MarketGuardJson as readonly unknown[];

/** Minimal typed fragments for the browser (wagmi hooks infer argument types from these). */
export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

export const vaultAbi = parseAbi([
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  "function maxWithdraw(address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)",
]);

export const morphoAbi = parseAbi([
  "struct MarketParams { address loanToken; address collateralToken; address oracle; address irm; uint256 lltv; }",
  "function supplyCollateral(MarketParams marketParams, uint256 assets, address onBehalf, bytes data)",
  "function withdrawCollateral(MarketParams marketParams, uint256 assets, address onBehalf, address receiver)",
  "function borrow(MarketParams marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256, uint256)",
  "function repay(MarketParams marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256, uint256)",
  "function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
  "function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
]);

export const faucetAbi = parseAbi([
  "function claim()",
  "function lastClaim(address) view returns (uint256)",
]);
