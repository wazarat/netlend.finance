"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { money } from "@netlend/sdk";
import { MetricTile, Tabs } from "@/components/ui";
import { MarketsTable } from "@/components/lending";
import { deployed } from "@/config/chain";
import { useMarkets, useStats } from "@/lib/data/queries";

type Filter = "all" | "stablecoins" | "stocks" | "rwas";
const FILTERS = [
  { id: "all" as const, label: "All" },
  { id: "stablecoins" as const, label: "Stablecoins" },
  { id: "stocks" as const, label: "Stocks" },
  { id: "rwas" as const, label: "RWAs" },
];

export function BorrowView() {
  const markets = useMarkets();
  const stats = useStats();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const all = markets.data ?? [];
    const byFilter =
      filter === "stablecoins" ? all.filter((m) => m.loan === "USDG") : filter === "stocks" ? all.filter((m) => m.category === "Stocks") : filter === "rwas" ? all.filter((m) => m.category === "RWA") : all;
    const s = q.trim().toLowerCase();
    return s ? byFilter.filter((m) => m.name.toLowerCase().includes(s) || m.key.toLowerCase().includes(s) || m.category.toLowerCase().includes(s)) : byFilter;
  }, [markets.data, filter, q]);
  return (
    <>
      <h1 className="t-h1">Markets</h1>
      <p className="nl-muted mt-1.5 mb-6">Supply to earn, or borrow against your collateral. Every market is isolated, with its oracle, liquidation LTV and cap fixed on chain.</p>
      <div className="nl-card grid grid-cols-2 gap-6 tablet:grid-cols-3 mb-6">
        <MetricTile label="Total supplied" loading={stats.isLoading} value={stats.data ? (deployed ? money(stats.data.totalSupplied) : "Coming soon") : undefined} sub="USDG markets" />
        <MetricTile label="Total borrowed" loading={stats.isLoading} value={stats.data ? (deployed ? money(stats.data.totalBorrowed) : "Coming soon") : undefined} sub="USDG markets" />
        <MetricTile label="Markets" loading={stats.isLoading} value={stats.data ? String(stats.data.activeMarkets) : undefined} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <Tabs items={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter markets" />
        <div className="nl-input nl-input--sm w-full tablet:w-[260px]">
          <Search aria-hidden="true" strokeWidth={1.5} />
          <input placeholder="Search assets" aria-label="Search assets" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {markets.isError && (
        <div className="nl-notice nl-notice--negative mb-4" role="alert">
          Could not read the markets from the chain. Check the RPC and try again.
        </div>
      )}
      <MarketsTable markets={rows} loading={markets.isLoading} emptyText={deployed ? "No markets match." : "Markets open once the contracts are on testnet. Nothing to show yet."} />
    </>
  );
}
