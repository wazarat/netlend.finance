"use client";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi, pct, tokenAmount, vaultAbi, type VaultRow } from "@netlend/sdk";
import { AmountInput, Tabs } from "@/components/ui";
import { deployed, wagmiChain } from "@/config/chain";
import { useIsMounted } from "@/lib/hooks/useIsMounted";
import { parseAmount } from "@/lib/position";
import { TxButton, type WriteConfig } from "./TxButton";

export type VaultMode = "deposit" | "withdraw";
const TABS = [
  { id: "deposit" as const, label: "Deposit" },
  { id: "withdraw" as const, label: "Withdraw" },
];

/** Deposit or withdraw on one vault, with the depositor's position and what is withdrawable now. Shared by the Earn list and the vault page. */
export function VaultActionPanel({ v, initialMode = "deposit", sticky = false }: { v: VaultRow; initialMode?: VaultMode; sticky?: boolean }) {
  const mounted = useIsMounted();
  const { address, chainId } = useAccount();
  const [mode, setMode] = useState<VaultMode>(initialMode);
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
  const firstMarket = v.supplyQueue[0];

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
  const help =
    mode === "deposit" && firstMarket
      ? `Deposits are lent to the ${firstMarket} market first (supply queue); borrowers can pull them into any market the vault lists.`
      : mode === "withdraw"
        ? "Withdrawals come from idle funds, then from markets in withdraw-queue order, up to their free liquidity."
        : undefined;

  return (
    <section className={["nl-panel", sticky && "nl-sticky"].filter(Boolean).join(" ")} aria-label={`${v.name} deposit or withdraw`} style={sticky ? undefined : { boxShadow: "none" }}>
      <Tabs items={TABS} value={mode} onChange={(m) => { setMode(m); setAmt(""); }} ariaLabel="Action" block />
      <AmountInput
        id={`amt-${v.key}`}
        label="Amount"
        token={v.assetSymbol}
        value={amt}
        onChange={setAmt}
        balanceLabel={enabled ? `${mode === "deposit" ? "Wallet" : "Withdrawable"} ${fmt(max)} ${v.assetSymbol}` : undefined}
        onMax={max !== undefined ? () => setAmt(formatUnits(max, v.decimals)) : undefined}
        help={help}
        error={reason && amount > 0n && enabled && chainId === wagmiChain.id ? reason : undefined}
      />
      <dl className="nl-stack" style={{ margin: 0 }}>
        <div className="nl-kv"><dt>Supply APY</dt><dd>{pct(v.apy)} variable</dd></div>
        <div className="nl-kv"><dt>Your position</dt><dd>{enabled ? `${fmt(position)} ${v.assetSymbol}` : "Connect wallet"}</dd></div>
        <div className="nl-kv"><dt>Withdrawable now</dt><dd>{enabled ? `${fmt(withdrawable)} ${v.assetSymbol}` : "—"}</dd></div>
      </dl>
      <TxButton label={label} write={write} disabledReason={reason} onConfirmed={() => setAmt("")} />
    </section>
  );
}
