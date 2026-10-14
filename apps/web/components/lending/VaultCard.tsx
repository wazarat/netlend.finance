"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { amountIn, pct, type VaultRow } from "@netlend/sdk";
import { MetricTile, StatusChip } from "@/components/ui";
import { VaultActionPanel, type VaultMode } from "./VaultActionPanel";

const RISK_TONE = { conservative: "positive", aggressive: "warning" } as const;

/** One vault on the Earn list: the facts, where the money is lent, and the deposit/withdraw panel. The name opens the vault page. */
export function VaultCard({ v, initialMode = "deposit" }: { v: VaultRow; initialMode?: VaultMode }) {
  const capped = v.markets.filter((vm) => vm.tripped).length;
  return (
    <article className="nl-card nl-market-layout" aria-labelledby={`vault-${v.key}`}>
      <div className="nl-stack" style={{ gap: "var(--space-5)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="t-eyebrow">{v.tier}</div>
            <h2 id={`vault-${v.key}`} className="t-h2">
              <Link href={`/earn/${encodeURIComponent(v.key)}`} className="nl-row-link inline-flex items-center gap-2">
                {v.name}
                <ArrowRight aria-hidden="true" width={18} height={18} strokeWidth={1.5} />
              </Link>
            </h2>
            <div className="t-body-sm nl-muted">
              {v.marketCount} markets · {pct(v.performanceFee, 0)} performance fee · {Math.round(v.timelockSeconds / 3600)}h timelock
            </div>
          </div>
          <div className="flex gap-2">
            {capped > 0 && <StatusChip tone="warning">{capped} market{capped > 1 ? "s" : ""} capped</StatusChip>}
            <StatusChip tone={RISK_TONE[v.risk as keyof typeof RISK_TONE] ?? "neutral"}>{v.risk === "aggressive" ? "Higher risk" : "Conservative"}</StatusChip>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
          <MetricTile label="Supply APY" value={pct(v.apy)} sub="Variable, blended" />
          <MetricTile label="Total supplied" value={amountIn(v.tvl, v.assetSymbol)} />
          <MetricTile label="Lent to markets" value={amountIn(v.allocated, v.assetSymbol)} sub={v.idle > 0 ? `${amountIn(v.idle, v.assetSymbol)} idle` : "Fully allocated"} />
        </div>
        <dl className="nl-stack" style={{ margin: 0 }}>
          {v.markets.map((vm) => (
            <div key={vm.key} className="nl-kv">
              <dt>
                <Link href={`/borrow/${encodeURIComponent(vm.key)}`} className="nl-row-link">{vm.key}</Link>
                {vm.tripped && <StatusChip tone="warning" size="sm">Capped</StatusChip>}
              </dt>
              <dd>
                {amountIn(vm.allocated, v.assetSymbol)} of {amountIn(vm.cap, v.assetSymbol)} cap · {pct(vm.supplyAPR)} · LLTV {pct(vm.lltv, 1)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <VaultActionPanel v={v} initialMode={initialMode} />
    </article>
  );
}
