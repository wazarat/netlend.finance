"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { amountIn, pct, registry, shortAddress, type VaultMarketRow, type VaultRow } from "@netlend/sdk";
import { CopyAddress, MetricTile, Skeleton, StatusChip } from "@/components/ui";
import { VaultActionPanel } from "@/components/lending";
import { addressUrl, book } from "@/config/chain";
import { useVault } from "@/lib/data/queries";

const RISK_TONE = { conservative: "positive", aggressive: "warning" } as const;
const ZERO = "0x0000000000000000000000000000000000000000";

function when(ts: number): string {
  return new Date(ts * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

/** Names a role address when it is one of ours; otherwise the short address. */
function roleName(a: string | undefined): string {
  if (!a || a === ZERO) return "Not set";
  const x = a.toLowerCase();
  if (x === (book.vaults?.marketGuard ?? "").toLowerCase()) return "MarketGuard (watchdog)";
  if (x === (book.token?.splitter ?? "").toLowerCase()) return "RevenueSplitter (75% treasury / 25% stakers)";
  if (x === String(book.core?.publicAllocator ?? "").toLowerCase()) return "PublicAllocator";
  return shortAddress(a);
}

export function VaultDetailView({ vaultKey }: { vaultKey: string }) {
  const q = useVault(vaultKey);
  const sp = useSearchParams();
  const initialMode = sp.get("tab") === "withdraw" ? "withdraw" : "deposit";
  const reg = registry.vaults.find((x) => x.key === vaultKey);
  const v = q.data;

  if (!reg && !q.isLoading && !v) {
    return (
      <>
        <Back />
        <h1 className="t-h1">Unknown vault</h1>
        <p className="nl-muted mt-2">There is no vault called {vaultKey}.</p>
      </>
    );
  }

  return (
    <>
      <Back />
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="t-h1">{v?.name ?? reg?.name ?? vaultKey}</h1>
        {v && <StatusChip tone={RISK_TONE[v.risk as keyof typeof RISK_TONE] ?? "neutral"}>{v.risk === "aggressive" ? "Higher risk" : "Conservative"}</StatusChip>}
      </div>
      <p className="nl-muted mt-0 mb-6">
        {v ? `${v.symbol} · ERC-4626 on MetaMorpho v1.1 · ` : ""}
        {v && <CopyAddress address={v.address} href={addressUrl(v.address)} />}
      </p>

      {q.isError && !v && (
        <div className="nl-notice nl-notice--negative mb-6" role="alert">
          Could not read this vault from the chain. Check the RPC and try again.
        </div>
      )}

      <div className="nl-market-layout">
        <div className="nl-stack" style={{ gap: "var(--space-5)" }}>
          <section className="nl-card grid grid-cols-2 gap-6 tablet:grid-cols-4" aria-label="Vault figures">
            <MetricTile label="Total supplied" loading={!v} value={v && amountIn(v.tvl, v.assetSymbol)} />
            <MetricTile label="Supply APY" loading={!v} value={v && pct(v.apy)} sub="Variable, blended" />
            <MetricTile label="Lent to markets" loading={!v} value={v && amountIn(v.allocated, v.assetSymbol)} />
            <MetricTile label="Idle" loading={!v} value={v && amountIn(v.idle, v.assetSymbol)} sub="Not in any market" />
          </section>

          <section className="nl-card" aria-labelledby="allocation">
            <h2 id="allocation" className="t-h3 mb-1">Allocation</h2>
            <p className="t-body-sm nl-muted mt-0 mb-4">
              Deposits fill the supply queue in order{v && v.supplyQueue.length > 0 ? `: ${v.supplyQueue.join(" → ")}` : ""}. Withdrawals drain the withdraw queue
              {v && v.withdrawQueue.length > 0 ? `: ${v.withdrawQueue.join(" → ")}` : ""}. Caps only rise through the {v ? Math.round(v.timelockSeconds / 3600) : "—"}h timelock; the watchdog can cut any cap to zero at once.
            </p>
            {!v ? (
              <Skeleton width="100%" height="24px" />
            ) : (
              <table className="nl-table">
                <thead>
                  <tr>
                    <th scope="col">Market</th>
                    <th scope="col" className="nl-r">Lent</th>
                    <th scope="col" className="nl-r">Cap</th>
                    <th scope="col" className="nl-r">Cap used</th>
                    <th scope="col" className="nl-r">Supply APY</th>
                    <th scope="col" className="nl-r">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {v.markets.map((vm) => (
                    <AllocationRow key={vm.key} v={v} vm={vm} />
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="nl-card" aria-labelledby="routing">
            <h2 id="routing" className="t-h3 mb-1">Liquidity routing</h2>
            <p className="t-body-sm nl-muted mt-0 mb-4">
              The PublicAllocator lets a borrower move this vault&apos;s liquidity into the market they borrow from, inside the caps above. The Borrow page does this as step one of two when a market runs dry.
            </p>
            {!v ? (
              <Skeleton width="60%" height="20px" />
            ) : (
              <dl className="nl-stack m-0" style={{ gap: "var(--space-3)" }}>
                <div className="nl-kv"><dt>Public allocator</dt><dd>{v.publicAllocator.isAllocator ? "Enabled" : "Not an allocator on this vault"}</dd></div>
                <div className="nl-kv"><dt>Reallocation fee</dt><dd>{v.publicAllocator.fee === "0" ? "None" : `${v.publicAllocator.fee} wei`}</dd></div>
                <div className="nl-kv">
                  <dt>Open flow caps</dt>
                  <dd>
                    {v.markets.filter((vm) => vm.flowCaps.maxIn > 0 && vm.flowCaps.maxOut > 0).length} of {v.markets.length} markets
                    {v.markets.some((vm) => vm.flowCaps.maxIn === 0) ? ` (closed: ${v.markets.filter((vm) => vm.flowCaps.maxIn === 0).map((vm) => vm.key).join(", ")})` : ""}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <section className="nl-card" aria-labelledby="roles">
            <h2 id="roles" className="t-h3 mb-4">Roles, fee and timelock</h2>
            {!v ? (
              <Skeleton width="60%" height="20px" />
            ) : (
              <dl className="nl-stack m-0" style={{ gap: "var(--space-3)" }}>
                <Role label="Owner" a={v.owner} />
                <Role label="Curator" a={v.curator} />
                <Role label="Guardian" a={v.guardian} />
                <Role label="Fee recipient" a={v.feeRecipient} />
                <div className="nl-kv"><dt>Performance fee</dt><dd>{pct(v.performanceFee, 0)} of interest earned</dd></div>
                <div className="nl-kv"><dt>Timelock</dt><dd>{Math.round(v.timelockSeconds / 3600)} hours{v.pendingTimelock ? ` · pending ${Math.round(v.pendingTimelock.seconds / 3600)}h from ${when(v.pendingTimelock.validAt)}` : ""}</dd></div>
                {v.pendingGuardian && <div className="nl-kv"><dt>Pending guardian</dt><dd>{shortAddress(v.pendingGuardian.address)} from {when(v.pendingGuardian.validAt)}</dd></div>}
                {v.lostAssets > 0 && <div className="nl-kv"><dt>Lost assets</dt><dd>{amountIn(v.lostAssets, v.assetSymbol)} (bad debt socialised)</dd></div>}
              </dl>
            )}
          </section>
        </div>
        {v ? (
          <VaultActionPanel v={v} initialMode={initialMode} sticky />
        ) : (
          <section className="nl-panel" aria-label="Actions">
            <Skeleton width="100%" height="40px" />
          </section>
        )}
      </div>
    </>
  );
}

function Back() {
  return (
    <Link href="/earn" className="inline-flex items-center gap-2 t-label nl-muted mb-4">
      <ArrowLeft aria-hidden="true" width={16} height={16} strokeWidth={1.5} /> All vaults
    </Link>
  );
}

function Role({ label, a }: { label: string; a: string }) {
  const named = roleName(a);
  return (
    <div className="nl-kv">
      <dt>{label}</dt>
      <dd>{a && a !== ZERO ? <>{named} {named !== shortAddress(a) && <CopyAddress address={a} href={addressUrl(a)} />}</> : "Not set"}</dd>
    </div>
  );
}

function AllocationRow({ v, vm }: { v: VaultRow; vm: VaultMarketRow }) {
  const used = vm.cap > 0 ? vm.allocated / vm.cap : 0;
  const status = vm.tripped
    ? { tone: "warning" as const, text: "Capped by watchdog" }
    : !vm.enabled
      ? { tone: "neutral" as const, text: "Disabled" }
      : vm.pendingCap
        ? { tone: "neutral" as const, text: `Cap → ${amountIn(vm.pendingCap.cap, v.assetSymbol)} ${when(vm.pendingCap.validAt)}` }
        : { tone: "positive" as const, text: "Active" };
  return (
    <tr>
      <td className="nl-primary">
        <Link href={`/borrow/${encodeURIComponent(vm.key)}`} className="nl-row-link">{vm.key}</Link>
        <span className="nl-sub">LLTV {pct(vm.lltv, 1)} · free liquidity {amountIn(vm.marketLiquidity, v.assetSymbol)}</span>
      </td>
      <td className="nl-r" data-label="Lent">{amountIn(vm.allocated, v.assetSymbol)}</td>
      <td className="nl-r" data-label="Cap">{amountIn(vm.cap, v.assetSymbol)}</td>
      <td className="nl-r" data-label="Cap used">{pct(used, 0)}</td>
      <td className="nl-r" data-label="Supply APY">{pct(vm.supplyAPR)}</td>
      <td className="nl-r" data-label="Status"><StatusChip tone={status.tone} size="sm">{status.text}</StatusChip></td>
    </tr>
  );
}
