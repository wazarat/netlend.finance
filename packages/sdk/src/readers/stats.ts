import type { MarketRow, Stats } from "../types";

/** Protocol-wide figures derived from the market rows (USDG markets only for the headline totals). */
export function computeStats(markets: MarketRow[], chain: string, chainId: number, deployed: boolean): Stats {
  const usdg = markets.filter((x) => x.loan === "USDG");
  const totalSupplied = usdg.reduce((s, x) => s + x.totalSupply, 0);
  const totalBorrowed = usdg.reduce((s, x) => s + x.totalBorrow, 0);
  return {
    chain,
    chainId,
    deployed,
    tvl: totalSupplied,
    totalSupplied,
    totalBorrowed,
    utilization: totalSupplied > 0 ? totalBorrowed / totalSupplied : 0,
    marketCount: markets.length,
    activeMarkets: markets.filter((x) => x.enabled).length,
    topSupplyAPR: Math.max(0, ...markets.map((x) => x.supplyAPR)),
    wethSupplied: markets.filter((x) => x.loan === "WETH").reduce((s, x) => s + x.totalSupply, 0),
  };
}
