import { formatUnits, type Address, type PublicClient } from "viem";
import { IIrm, IMorpho, IOracle } from "../abis";
import type { AddressBook, MarketRow, Registry } from "../types";
import { multiRead } from "./multiRead";

const SECONDS_PER_YEAR = 31_536_000;

type MorphoMarket = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
};

const EMPTY_MARKET: MorphoMarket = { totalSupplyAssets: 0n, totalSupplyShares: 0n, totalBorrowAssets: 0n, totalBorrowShares: 0n, lastUpdate: 0n, fee: 0n };

function asMarket(v: unknown): MorphoMarket | null {
  if (!v) return null;
  if (Array.isArray(v)) {
    const [a, b, c, d, e, f] = v as bigint[];
    return { totalSupplyAssets: a, totalSupplyShares: b, totalBorrowAssets: c, totalBorrowShares: d, lastUpdate: e, fee: f };
  }
  return v as MorphoMarket;
}

/** (1 + r)^T - 1 with r per second; the continuous approximation is accurate for the rates Morpho's IRM produces. */
export function aprFromRate(ratePerSecond: bigint): number {
  return Math.expm1((Number(ratePerSecond) / 1e18) * SECONDS_PER_YEAR);
}

/** Decimals of a loan or collateral token: USDG is 6, every other token on this deployment is 18. */
export function tokenDecimals(book: AddressBook, token: Address): number {
  return token.toLowerCase() === (book.substitutes?.usdg ?? "").toLowerCase() ? 6 : 18;
}

/** Live market rows, read straight from Morpho, each oracle and the IRM. Empty until Deploy04 has run. */
export async function readMarkets(client: PublicClient, book: AddressBook, registry: Registry): Promise<MarketRow[]> {
  const morpho = book.core?.morpho as Address | undefined;
  const keys = Object.keys(book.markets ?? {});
  if (!morpho || keys.length === 0) return [];

  const first = await multiRead(
    client,
    book,
    keys.flatMap((k) => {
      const m = book.markets[k];
      return [
        { address: morpho, abi: IMorpho, functionName: "market", args: [m.id] },
        { address: m.oracle, abi: IOracle, functionName: "price" },
      ];
    }),
  );

  // borrowRateView needs the live Market struct, so rates are a second pass.
  const rates = await multiRead(
    client,
    book,
    keys.map((k, i) => {
      const m = book.markets[k];
      const params = { loanToken: m.loanToken, collateralToken: m.collateralToken, oracle: m.oracle, irm: m.irm, lltv: BigInt(m.lltv) };
      const market = first[i * 2].status === "success" ? asMarket(first[i * 2].result) : null;
      return { address: m.irm, abi: IIrm, functionName: "borrowRateView", args: [params, market ?? EMPTY_MARKET] };
    }),
  );

  return keys.map((k, i) => {
    const m = book.markets[k];
    const r = registry.markets.find((x) => x.key === k);
    const mk = first[i * 2].status === "success" ? asMarket(first[i * 2].result) : null;
    const px = first[i * 2 + 1].status === "success" ? (first[i * 2 + 1].result as bigint) : 0n;
    const rate = rates[i].status === "success" ? (rates[i].result as bigint) : 0n;
    const loanDec = tokenDecimals(book, m.loanToken);
    const collDec = tokenDecimals(book, m.collateralToken);
    const totalSupply = mk ? Number(formatUnits(mk.totalSupplyAssets, loanDec)) : 0;
    const totalBorrow = mk ? Number(formatUnits(mk.totalBorrowAssets, loanDec)) : 0;
    const fee = mk ? Number(formatUnits(mk.fee, 18)) : 0;
    const utilization = totalSupply > 0 ? totalBorrow / totalSupply : 0;
    const borrowAPR = aprFromRate(rate);
    const supplyAPR = borrowAPR * utilization * (1 - fee);
    // Oracle price is loan base units per collateral base unit scaled by 1e36; convert to a price per whole token.
    const price = (Number(px) / 1e36) * 10 ** (collDec - loanDec);
    const lltv = Number(formatUnits(BigInt(m.lltv), 18));
    const loan: "USDG" | "WETH" = loanDec === 6 ? "USDG" : "WETH";
    const available = Math.max(totalSupply - totalBorrow, 0);
    const oracleType = r?.oracleType === "twap" ? "twap" : "chainlink";
    return {
      key: k,
      name: r?.name ?? k,
      symbol: k,
      displayName: r?.name ?? k,
      isShort: !!r?.isShort,
      category: m.category,
      status: "live",
      loan,
      marketId: m.id,
      collateralAddress: m.collateralToken,
      loanAddress: m.loanToken,
      oracle: m.oracle,
      oracleLabel: oracleType === "twap" ? "Uniswap v3 TWAP" : `Chainlink-style ${r?.feed ?? k}`,
      oracleType,
      irm: "Adaptive Curve",
      lltv,
      maxLTV: lltv,
      price,
      collateralPriceUSDG: price,
      totalSupply,
      totalBorrow,
      utilization,
      availableToBorrow: available,
      available,
      borrowAPR,
      supplyAPR,
      cap: Number(formatUnits(BigInt(m.cap), loanDec)),
      enabled: true,
      fee,
    };
  });
}
