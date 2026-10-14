"use client";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi, healthFactor, maxBorrow, morphoAbi, pct, price as fmtPrice, registry, SAFE_CAP, tokenAmount, type MarketRow } from "@netlend/sdk";
import { AmountInput, Tabs } from "@/components/ui";
import { book, deployed, wagmiChain } from "@/config/chain";
import { useIsMounted } from "@/lib/hooks/useIsMounted";
import { derivePosition, parseAmount, type MarketTuple, type PositionTuple } from "@/lib/position";
import { HealthFactor } from "./HealthFactor";
import { TxButton, type WriteConfig } from "./TxButton";

export type MarketMode = "supply" | "borrow" | "repay" | "withdraw";
export const MARKET_MODES: MarketMode[] = ["supply", "borrow", "repay", "withdraw"];
const TABS = [
  { id: "supply" as const, label: "Supply" },
  { id: "borrow" as const, label: "Borrow" },
  { id: "repay" as const, label: "Repay" },
  { id: "withdraw" as const, label: "Withdraw" },
];

/** Supply collateral, borrow, repay and withdraw collateral on one Morpho market. Ported from the Vite Market route. */
export function MarketPanel({ m, initialMode = "supply" }: { m: MarketRow; initialMode?: MarketMode }) {
  const mounted = useIsMounted();
  const { address, chainId } = useAccount();
  const [mode, setMode] = useState<MarketMode>(initialMode);
  const [amt, setAmt] = useState("");
  const user = address as `0x${string}` | undefined;
  const enabled = mounted && !!user;

  const morpho = book.core.morpho as `0x${string}`;
  const bm = book.markets[m.key];
  const params = { loanToken: bm.loanToken, collateralToken: bm.collateralToken, oracle: bm.oracle, irm: bm.irm, lltv: BigInt(bm.lltv) };
  const reg = registry.markets.find((x) => x.key === m.key);
  const collSym = reg?.collateral ?? m.key;
  const loanSym = m.loan;

  const { data: pos } = useReadContract({ address: morpho, abi: morphoAbi, functionName: "position", args: [m.marketId, user!], query: { enabled } });
  const { data: mk } = useReadContract({ address: morpho, abi: morphoAbi, functionName: "market", args: [m.marketId] });
  const { data: collAllowance } = useReadContract({ address: bm.collateralToken, abi: erc20Abi, functionName: "allowance", args: [user!, morpho], query: { enabled } });
  const { data: loanAllowance } = useReadContract({ address: bm.loanToken, abi: erc20Abi, functionName: "allowance", args: [user!, morpho], query: { enabled } });
  const { data: collBalance } = useReadContract({ address: bm.collateralToken, abi: erc20Abi, functionName: "balanceOf", args: [user!], query: { enabled } });
  const { data: loanBalance } = useReadContract({ address: bm.loanToken, abi: erc20Abi, functionName: "balanceOf", args: [user!], query: { enabled } });

  const p = derivePosition(m, book, pos as PositionTuple | undefined, mk as MarketTuple | undefined);
  const dec = mode === "supply" || mode === "withdraw" ? p.collDec : p.loanDec;
  const sym = mode === "supply" || mode === "withdraw" ? collSym : loanSym;
  const amount = parseAmount(amt, dec);
  const amountNum = Number(formatUnits(amount, dec));

  // Projected position after the entered amount.
  const projCollateral = mode === "supply" ? p.collateral + amountNum : mode === "withdraw" ? p.collateral - amountNum : p.collateral;
  const projDebt = mode === "borrow" ? p.debt + amountNum : mode === "repay" ? Math.max(p.debt - amountNum, 0) : p.debt;
  const projHf = healthFactor(projCollateral * m.price, m.lltv, projDebt);

  const maxBorrowNum = Math.min(maxBorrow(p.collValue, m.lltv, p.debt), m.availableToBorrow);
  const requiredColl = m.price > 0 ? p.debt / (m.price * m.lltv * SAFE_CAP) : 0;
  const maxWithdrawNum = Math.max(p.collateral - requiredColl, 0);
  const maxRepay = loanBalance !== undefined ? (p.debtRaw < loanBalance ? p.debtRaw : loanBalance) : p.debtRaw;

  const needsApproval = (mode === "supply" && amount > 0n && (collAllowance ?? 0n) < amount) || (mode === "repay" && amount > 0n && (loanAllowance ?? 0n) < amount);

  const reason = useMemo(() => {
    if (!deployed) return "Contracts not on testnet yet";
    if (!enabled) return "Connect wallet to continue";
    if (chainId !== wagmiChain.id) return `Switch to ${wagmiChain.name}`;
    if (amount === 0n) return "Enter an amount";
    if (mode === "supply" && collBalance !== undefined && amount > collBalance) return "Insufficient balance";
    if (mode === "repay" && loanBalance !== undefined && amount > loanBalance) return "Insufficient balance";
    if (mode === "repay" && p.debt === 0) return "Nothing to repay";
    if (mode === "borrow" && amountNum > m.availableToBorrow) return "Not enough liquidity in this market";
    if (mode === "borrow" && amountNum > maxBorrowNum + 1e-9) return "Exceeds safe borrow limit";
    if (mode === "withdraw" && amountNum > p.collateral + 1e-9) return "Exceeds your collateral";
    if (mode === "withdraw" && amountNum > maxWithdrawNum + 1e-9) return "Health factor too low, add collateral or repay";
    return undefined;
  }, [enabled, chainId, amount, amountNum, mode, collBalance, loanBalance, p.debt, p.collateral, m.availableToBorrow, maxBorrowNum, maxWithdrawNum]);

  const write: WriteConfig | null = !user || amount === 0n
    ? null
    : needsApproval
      ? mode === "supply"
        ? { address: bm.collateralToken, abi: erc20Abi, functionName: "approve", args: [morpho, amount] }
        : { address: bm.loanToken, abi: erc20Abi, functionName: "approve", args: [morpho, amount] }
      : mode === "supply"
        ? { address: morpho, abi: morphoAbi, functionName: "supplyCollateral", args: [params, amount, user, "0x"] }
        : mode === "withdraw"
          ? { address: morpho, abi: morphoAbi, functionName: "withdrawCollateral", args: [params, amount, user, user] }
          : mode === "borrow"
            ? { address: morpho, abi: morphoAbi, functionName: "borrow", args: [params, amount, 0n, user, user] }
            : amount >= p.debtRaw && p.debtRaw > 0n && pos
              ? { address: morpho, abi: morphoAbi, functionName: "repay", args: [params, 0n, (pos as PositionTuple)[1], user, "0x"] }
              : { address: morpho, abi: morphoAbi, functionName: "repay", args: [params, amount, 0n, user, "0x"] };

  const verb = { supply: "Supply", borrow: "Borrow", repay: "Repay", withdraw: "Withdraw" }[mode];
  const label = needsApproval ? `Approve ${sym}` : `${verb} ${sym}`;

  const onMax = () => {
    if (mode === "supply" && collBalance !== undefined) setAmt(formatUnits(collBalance, dec));
    else if (mode === "borrow") setAmt(maxBorrowNum.toFixed(Math.min(dec, 6)));
    else if (mode === "repay") setAmt(formatUnits(maxRepay, dec));
    else if (mode === "withdraw") setAmt(maxWithdrawNum.toFixed(Math.min(dec, 6)));
  };

  const balanceLabel = !enabled
    ? undefined
    : mode === "supply"
      ? `Wallet ${collBalance !== undefined ? tokenAmount(Number(formatUnits(collBalance, dec)), 4) : "—"} ${collSym}`
      : mode === "repay"
        ? `Wallet ${loanBalance !== undefined ? tokenAmount(Number(formatUnits(loanBalance, dec)), 4) : "—"} ${loanSym}`
        : mode === "borrow"
          ? `Max ${tokenAmount(maxBorrowNum, 2)} ${loanSym}`
          : `Max ${tokenAmount(maxWithdrawNum, 4)} ${collSym}`;

  const help =
    mode === "borrow"
      ? `Safe cap ${pct(SAFE_CAP, 0)} of the ${pct(m.lltv, 1)} liquidation LTV`
      : mode === "supply" && m.isShort
        ? "Post USDG as margin, borrow ETH and sell it. Buy it back to repay."
        : amountNum > 0 && m.loan === "USDG" && (mode === "supply" || mode === "withdraw")
          ? `About ${fmtPrice(amountNum * m.price, "USDG")}`
          : undefined;

  return (
    <section className="nl-panel nl-sticky" aria-label="Supply, borrow, repay or withdraw">
      <Tabs items={TABS} value={mode} onChange={(x) => { setMode(x); setAmt(""); }} ariaLabel="Action" block />
      <AmountInput
        id={`amt-${m.key}-${mode}`}
        label="Amount"
        token={sym}
        value={amt}
        onChange={setAmt}
        balanceLabel={balanceLabel}
        onMax={enabled ? onMax : undefined}
        help={help}
        error={reason && amount > 0n && enabled && chainId === wagmiChain.id ? reason : undefined}
      />
      <dl className="nl-stack" style={{ margin: 0 }}>
        <div className="nl-kv"><dt>Collateral price</dt><dd>{fmtPrice(m.price, m.loan)}</dd></div>
        <div className="nl-kv"><dt>Borrow APY</dt><dd>{pct(m.borrowAPR)} variable</dd></div>
        <div className="nl-kv"><dt>Liquidation LTV</dt><dd>{pct(m.lltv, 1)}</dd></div>
        <div className="nl-kv"><dt>Your collateral</dt><dd>{enabled ? `${tokenAmount(p.collateral, 4)} ${collSym}` : "Connect wallet"}</dd></div>
        <div className="nl-kv"><dt>Your debt</dt><dd>{enabled ? `${tokenAmount(p.debt, 4)} ${loanSym}` : "—"}</dd></div>
        <div className="nl-kv"><dt>Liquidation price</dt><dd>{enabled && p.liq ? fmtPrice(p.liq, m.loan) : "—"}</dd></div>
      </dl>
      <HealthFactor value={p.hf} projected={amount > 0n ? projHf : undefined} compact />
      <TxButton label={label} write={write} disabledReason={reason} onConfirmed={() => setAmt("")} />
    </section>
  );
}
