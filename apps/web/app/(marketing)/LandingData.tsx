"use client";
import { money, pct } from "@netlend/sdk";
import { MetricTile } from "@/components/ui";
import { MarketsTable } from "@/components/lending";
import { useMarkets, useStats, useVaults } from "@/lib/data/queries";

/** The hero stats card. Figures come from the chain; before deployment it says so instead of showing zeros. */
export function HeroStats() {
  const stats = useStats();
  const vaults = useVaults();
  const live = stats.data?.deployed && (stats.data?.activeMarkets ?? 0) > 0;
  const bestUsdg = vaults.data ? Math.max(0, ...vaults.data.vaults.filter((v) => v.assetSymbol === "USDG").map((v) => v.apy)) : undefined;
  const soon = <span className="t-h3 nl-muted">Coming soon</span>;
  return (
    <div className="nl-card grid gap-5" aria-label="Protocol figures">
      <MetricTile label="Total supplied" loading={stats.isLoading} value={stats.data ? (live ? money(stats.data.totalSupplied) : soon) : undefined} />
      <hr className="nl-divider" />
      <MetricTile label="Total borrowed" loading={stats.isLoading} value={stats.data ? (live ? money(stats.data.totalBorrowed) : soon) : undefined} />
      <hr className="nl-divider" />
      <MetricTile label="Stablecoin supply APY" loading={stats.isLoading || (live && vaults.isLoading)} value={stats.data ? (live && bestUsdg !== undefined ? pct(bestUsdg) : soon) : undefined} sub="Variable, best USDG vault" />
    </div>
  );
}

export function MarketsPreview() {
  const markets = useMarkets();
  const top = markets.data ? [...markets.data].sort((a, b) => b.totalSupply - a.totalSupply).slice(0, 4) : undefined;
  return <MarketsTable markets={top} loading={markets.isLoading} compact />;
}
