"use client";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi, money, pct, tokenAmount, vaultAbi, type VaultRow } from "@netlend/sdk";
import { AmountInput, StatusChip, Tabs } from "@/components/ui";
import { MetricTile } from "@/components/ui";
import { book, deployed, wagmiChain } from "@/config/chain";
import { useIsMounted } from "@/lib/hooks/useIsMounted";
import { parseAmount } from "@/lib/position";
import { TxButton, type WriteConfig } from "./TxButton";

type Mode = "deposit" | "withdraw";
const TABS = [
  { id: "deposit" as const, label: "Deposit" },
  { id: "withdraw" as const, label: "Withdraw" },
];

const RISK_TONE = { conservative: "positive", aggressive: "warning" } as const;

/** One vault: the facts, your position, and the deposit/withdraw panel. Ported from the Vite Earn route. */
export function VaultCard({ v, initialMode = "deposit" }: { v: VaultRow; initialMode?: Mode }) {
  const mounted = useIsMounted();
  const { address, chainId } = useAccount();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [amt, setAmt] = useState("");
  const user = address as `0x${string}` | undefined;
  const enabled = mounted && !!user;

  const { data: allowance } = useReadContract({ address: v.asset, abi: erc20Abi, functionName: "allowance", args: [user!, v.address], query: { enabled } });
  const { data: balance } = useReadContract({ address: v.asset, abi: erc20Abi, functionName: "balanceOf", args: [user!], query: { enabled } });
  const { data: shares } = useReadContract({ address: v.address, abi: vaultAbi, functionName: "balanceOf", args: [user!], query: { enabled } });
  const { data: position } = useReadContract({ address: v.address, abi: vaultAbi, functionName: "convertToAssets", args: [shares ?? 0n], query: { enabled: enabled && shares !== undefined } });
  const { data: withdrawable } = useReadContract({ address: v.address, abi: vaultAbi, functionName: "maxWithdraw", args: [user!], query: { enabled } });

  const amount = parseAmount(amt, v.decimals);
  const fmt = (x: bigint | undefined, dp = 4) => (x === undefined ? "—" : tokenAmount(Number(formatUnits(x, v.decimals)), dp));
  const max = mode === "deposit" ? balance : withdrawable;
  const needsApproval = mode === "deposit" && amount > 0n && (allowance ?? 0n) < amount;

  const reason = useMemo(() => {
    if (!deployed) return "Contracts not on testnet yet";
    if (!enabled) return "Connect wallet to continue";
    if (chainId !== wagmiChain.id) return `Switch to ${wagmiChain.name}`;
    if (amount === 0n) return "Enter an amount";
    if (mode === "deposit" && balance !== undefined && amount > balance) return "Insufficient balance";
    if (mode === "withdraw" && withdrawable !== undefined && amount > withdrawable) return "Exceeds withdrawable amount";
    return undefined;
  }, [enabled, chainId, amount, mode, balance, withdrawable]);

  const write: WriteConfig | null = !user || amount === 0n
    ? null
    : needsApproval
      ? { address: v.asset, abi: erc20Abi, functionName: "approve", args: [v.address, amount] }
      : mode === "deposit"
        ? { address: v.address, abi: vaultAbi, functionName: "deposit", args: [amount, user] }
        : { address: v.address, abi: vaultAbi, functionName: "withdraw", args: [amount, user, user] };

  const label = needsApproval ? `Approve ${v.assetSymbol}` : mode === "deposit" ? `Deposit ${v.assetSymbol}` : `Withdraw ${v.assetSymbol}`;

  return (
    <article className="nl-card nl-market-layout" aria-labelledby={`vault-${v.key}`}>
      <div className="nl-stack" style={{ gap: "var(--space-5)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="t-eyebrow">{v.tier}</div>
            <h2 id={`vault-${v.key}`} className="t-h2">{v.name}</h2>
            <div className="t-body-sm nl-muted">
              {v.marketCount} markets · {pct(v.performanceFee, 0)} performance fee · {Math.round(v.timelockSeconds / 3600)}h timelock
            </div>
          </div>
          <StatusChip tone={RISK_TONE[v.risk as keyof typeof RISK_TONE] ?? "neutral"}>{v.risk === "aggressive" ? "Higher risk" : "Conservative"}</StatusChip>
        </div>
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
          <MetricTile label="Supply APY" value={pct(v.apy)} sub="Variable" />
          <MetricTile label="Total supplied" value={v.assetSymbol === "USDG" ? money(v.tvl) : `${tokenAmount(v.tvl, 4)} WETH`} />
          <MetricTile label="Allocated" value={v.assetSymbol === "USDG" ? money(v.allocated) : `${tokenAmount(v.allocated, 4)} WETH`} sub="Lent to markets" />
        </div>
        <dl className="nl-stack" style={{ margin: 0 }}>
          {v.markets.map((vm) => (
            <div key={vm.key} className="nl-kv">
              <dt>{vm.key}</dt>
              <dd>
                {pct(vm.supplyAPR)} · cap {v.assetSymbol === "USDG" ? money(vm.cap) : `${tokenAmount(vm.cap, 2)} WETH`} · LLTV {pct(vm.lltv, 1)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <section className="nl-panel" aria-label={`${v.name} deposit or withdraw`} style={{ boxShadow: "none" }}>
        <Tabs items={TABS} value={mode} onChange={(m) => { setMode(m); setAmt(""); }} ariaLabel="Action" block />
        <AmountInput
          id={`amt-${v.key}`}
          label="Amount"
          token={v.assetSymbol}
          value={amt}
          onChange={setAmt}
          balanceLabel={enabled ? `${mode === "deposit" ? "Wallet" : "Withdrawable"} ${fmt(max)} ${v.assetSymbol}` : undefined}
          onMax={max !== undefined ? () => setAmt(formatUnits(max, v.decimals)) : undefined}
          error={reason && amount > 0n && enabled && chainId === wagmiChain.id ? reason : undefined}
        />
        <dl className="nl-stack" style={{ margin: 0 }}>
          <div className="nl-kv"><dt>Supply APY</dt><dd>{pct(v.apy)} variable</dd></div>
          <div className="nl-kv"><dt>Your position</dt><dd>{enabled ? `${fmt(position)} ${v.assetSymbol}` : "Connect wallet"}</dd></div>
          <div className="nl-kv"><dt>Withdrawable now</dt><dd>{enabled ? `${fmt(withdrawable)} ${v.assetSymbol}` : "—"}</dd></div>
        </dl>
        <TxButton label={label} write={write} disabledReason={reason} onConfirmed={() => setAmt("")} />
      </section>
    </article>
  );
}
