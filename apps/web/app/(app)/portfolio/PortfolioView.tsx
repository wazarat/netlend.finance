"use client";
import Link from "next/link";
import { formatUnits } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { healthWord, money, morphoAbi, pct, price as fmtPrice, tokenAmount, vaultAbi } from "@netlend/sdk";
import { Button, MetricTile, StatusChip } from "@/components/ui";
import { ConnectPrompt } from "@/components/layout";
import { HealthFactor } from "@/components/lending";
import { book, deployed } from "@/config/chain";
import { useMarkets, useVaults } from "@/lib/data/queries";
import { useIsMounted } from "@/lib/hooks/useIsMounted";
import { derivePosition, type MarketTuple, type PositionTuple } from "@/lib/position";

const TONE = { Healthy: "positive", Caution: "warning", "At risk": "negative", "No borrows": "neutral" } as const;

export function PortfolioView() {
  const mounted = useIsMounted();
  const { address } = useAccount();
  const markets = useMarkets();
  const vaults = useVaults();
  const morpho = book.core.morpho as `0x${string}` | undefined;
  const user = address as `0x${string}` | undefined;

  const { data: positions } = useReadContracts({
    contracts: (markets.data ?? []).flatMap((m) => [
      { address: morpho!, abi: morphoAbi, functionName: "position", args: [m.marketId, user!] },
      { address: morpho!, abi: morphoAbi, functionName: "market", args: [m.marketId] },
    ]),
    query: { enabled: mounted && !!user && !!morpho && !!markets.data },
  });
  const { data: vaultBalances } = useReadContracts({
    contracts: (vaults.data?.vaults ?? []).map((v) => ({ address: v.address, abi: vaultAbi, functionName: "maxWithdraw", args: [user!] })),
    query: { enabled: mounted && !!user && !!vaults.data },
  });

  if (!mounted || !user) {
    return (
      <>
        <h1 className="t-h1 mb-6">Portfolio</h1>
        <div className="max-w-[520px]">
          <ConnectPrompt />
        </div>
      </>
    );
  }

  const borrows = (markets.data ?? [])
    .map((m, i) => {
      const pos = positions?.[i * 2]?.result as PositionTuple | undefined;
      const mk = positions?.[i * 2 + 1]?.result as MarketTuple | undefined;
      if (!pos || !mk) return null;
      const d = derivePosition(m, book, pos, mk);
      if (d.collateral === 0 && d.debt === 0) return null;
      return { m, ...d };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const supplies = (vaults.data?.vaults ?? []).map((v, i) => {
    const raw = vaultBalances?.[i]?.result as bigint | undefined;
    return { v, amount: raw === undefined ? undefined : Number(formatUnits(raw, v.decimals)) };
  });

  const suppliedUsd = supplies.reduce((s, x) => s + (x.v.assetSymbol === "USDG" ? x.amount ?? 0 : 0), 0);
  const collateralUsd = borrows.filter((b) => b.m.loan === "USDG").reduce((s, b) => s + b.collValue, 0);
  const debtUsd = borrows.filter((b) => b.m.loan === "USDG").reduce((s, b) => s + b.debt, 0);
  const worst = borrows.reduce<number | null>((w, b) => (b.hf === null ? w : w === null ? b.hf : Math.min(w, b.hf)), null);
  const loading = markets.isLoading || vaults.isLoading || (deployed && (positions === undefined || vaultBalances === undefined));

  return (
    <>
      <h1 className="t-h1 mb-6">Portfolio</h1>
      <div className="nl-card grid grid-cols-2 gap-6 desktop:grid-cols-4 mb-8">
        <MetricTile label="Supplied to vaults" loading={loading} value={money(suppliedUsd)} sub="USDG vaults" />
        <MetricTile label="Collateral" loading={loading} value={money(collateralUsd)} sub="USDG markets" />
        <MetricTile label="Borrowed" loading={loading} value={money(debtUsd)} sub="USDG markets" />
        <HealthFactor value={worst} label="Lowest health factor" sub={borrows.length ? "Across your borrows" : "Nothing borrowed"} />
      </div>

      <h2 className="t-h2 mb-4">Your supplies</h2>
      <table className="nl-table mb-8">
        <thead>
          <tr>
            <th scope="col">Vault</th>
            <th scope="col" className="nl-r">Withdrawable now</th>
            <th scope="col" className="nl-r">Supply APY</th>
            <th scope="col" className="nl-r">Action</th>
          </tr>
        </thead>
        <tbody>
          {supplies.length === 0 && (
            <tr>
              <td className="nl-primary nl-muted" colSpan={4}>
                {deployed ? "No vault deposits yet." : "Vaults open once the contracts are on testnet."} <Link href="/earn">Go to Earn</Link>
              </td>
            </tr>
          )}
          {supplies.map(({ v, amount }) => (
            <tr key={v.key}>
              <td className="nl-primary">{v.name}</td>
              <td className="nl-r" data-label="Withdrawable now">{amount === undefined ? "—" : `${tokenAmount(amount, 4)} ${v.assetSymbol}`}</td>
              <td className="nl-r" data-label="Supply APY">{pct(v.apy)}</td>
              <td className="nl-r" data-label="Action">
                <Button href={`/earn?vault=${v.key}&tab=withdraw`} variant="secondary" size="sm">Withdraw</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="t-h2 mb-4">Your borrows</h2>
      <table className="nl-table">
        <thead>
          <tr>
            <th scope="col">Market</th>
            <th scope="col" className="nl-r">Collateral</th>
            <th scope="col" className="nl-r">Debt</th>
            <th scope="col" className="nl-r">LTV</th>
            <th scope="col" className="nl-r">Health</th>
            <th scope="col" className="nl-r">Liquidation price</th>
            <th scope="col" className="nl-r">Action</th>
          </tr>
        </thead>
        <tbody>
          {borrows.length === 0 && (
            <tr>
              <td className="nl-primary nl-muted" colSpan={7}>
                {deployed ? "No open positions." : "Markets open once the contracts are on testnet."} <Link href="/borrow">Browse markets</Link>
              </td>
            </tr>
          )}
          {borrows.map((b) => (
            <tr key={b.m.key}>
              <td className="nl-primary">
                <Link href={`/borrow/${encodeURIComponent(b.m.key)}`} className="nl-row-link">{b.m.name}</Link>
              </td>
              <td className="nl-r" data-label="Collateral">{tokenAmount(b.collateral, 4)}</td>
              <td className="nl-r" data-label="Debt">{tokenAmount(b.debt, 4)} {b.m.loan}</td>
              <td className="nl-r" data-label="LTV">{pct(b.ltv, 1)}</td>
              <td className="nl-r" data-label="Health">
                <StatusChip tone={TONE[healthWord(b.hf)]} size="sm">{b.hf === null ? "No borrows" : `${b.hf.toFixed(2)} ${healthWord(b.hf)}`}</StatusChip>
              </td>
              <td className="nl-r" data-label="Liquidation price">{b.liq ? fmtPrice(b.liq, b.m.loan) : "—"}</td>
              <td className="nl-r" data-label="Action">
                <Button href={`/borrow/${encodeURIComponent(b.m.key)}?tab=repay`} variant="secondary" size="sm" className="relative z-10">Repay</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
