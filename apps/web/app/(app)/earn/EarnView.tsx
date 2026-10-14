"use client";
import { useSearchParams } from "next/navigation";
import { money, tokenAmount } from "@netlend/sdk";
import { MetricTile, Skeleton } from "@/components/ui";
import { VaultCard } from "@/components/lending";
import { deployed } from "@/config/chain";
import { useVaults } from "@/lib/data/queries";

export function EarnView() {
  const vaults = useVaults();
  const sp = useSearchParams();
  const initialMode = sp.get("tab") === "withdraw" ? "withdraw" : "deposit";
  const focus = sp.get("vault");
  const list = vaults.data?.vaults ?? [];
  const ordered = focus ? [...list].sort((a, b) => (a.key === focus ? -1 : b.key === focus ? 1 : 0)) : list;
  return (
    <>
      <h1 className="t-h1">Earn</h1>
      <p className="nl-muted mt-1.5 mb-6">Supply USDG or WETH to a curated vault. One position per vault, allocated across isolated markets with every parameter published on chain.</p>
      <div className="nl-card grid grid-cols-1 gap-6 tablet:grid-cols-3 mb-6">
        <MetricTile label="USDG supplied" loading={vaults.isLoading} value={vaults.data ? (deployed ? money(vaults.data.totals.tvlUsdg) : "Coming soon") : undefined} />
        <MetricTile label="WETH supplied" loading={vaults.isLoading} value={vaults.data ? (deployed ? `${tokenAmount(vaults.data.totals.tvlWeth, 4)} WETH` : "Coming soon") : undefined} />
        <MetricTile label="Vaults" loading={vaults.isLoading} value={vaults.data ? String(vaults.data.vaults.length) : undefined} />
      </div>
      {vaults.isLoading && (
        <div className="nl-card">
          <Skeleton width="40%" height="24px" />
        </div>
      )}
      {vaults.isError && (
        <div className="nl-notice nl-notice--negative" role="alert">
          Could not read the vaults from the chain. Check the RPC and try again.
        </div>
      )}
      {vaults.data && list.length === 0 && (
        <div className="nl-notice nl-notice--neutral">Vaults open once the contracts are on testnet. Nothing to show yet.</div>
      )}
      <div className="grid gap-6">
        {ordered.map((v) => (
          <VaultCard key={v.key} v={v} initialMode={v.key === focus ? initialMode : "deposit"} />
        ))}
      </div>
    </>
  );
}
