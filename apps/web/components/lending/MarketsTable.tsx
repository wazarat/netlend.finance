import Link from "next/link";
import type { MarketRow } from "@netlend/sdk";
import { amountIn, pct } from "@netlend/sdk";
import { Skeleton, StatusChip, TokenDot } from "@/components/ui";

const CATEGORY_LABEL: Record<string, string> = { Stocks: "Tokenized stock", RWA: "Real-world asset", Crypto: "Crypto", Memes: "Long-tail token", Short: "Short", Stables: "Stablecoin" };

type Props = { markets: MarketRow[] | undefined; loading?: boolean; compact?: boolean; emptyText?: string };

/** Markets as a table on desktop and as cards under 720px. Rows link to the market page. */
export function MarketsTable({ markets, loading, compact, emptyText = "Markets open once the contracts are on testnet." }: Props) {
  const rows = markets ?? [];
  return (
    <table className="nl-table">
      <thead>
        <tr>
          <th scope="col">Market</th>
          <th scope="col" className="nl-r">Total supplied</th>
          <th scope="col" className="nl-r">Supply APY</th>
          <th scope="col" className="nl-r">Borrow APY</th>
          {!compact && <th scope="col" className="nl-r">Available</th>}
          <th scope="col" className="nl-r">Max LTV</th>
          {!compact && <th scope="col" className="nl-r">Status</th>}
        </tr>
      </thead>
      <tbody>
        {loading &&
          [0, 1, 2, 3].map((i) => (
            <tr key={i}>
              <td className="nl-primary"><Skeleton width="12ch" /></td>
              <td className="nl-r" data-label="Total supplied"><Skeleton /></td>
              <td className="nl-r" data-label="Supply APY"><Skeleton /></td>
              <td className="nl-r" data-label="Borrow APY"><Skeleton /></td>
              {!compact && <td className="nl-r" data-label="Available"><Skeleton /></td>}
              <td className="nl-r" data-label="Max LTV"><Skeleton /></td>
              {!compact && <td className="nl-r" data-label="Status"><Skeleton /></td>}
            </tr>
          ))}
        {!loading && rows.length === 0 && (
          <tr>
            <td className="nl-primary nl-muted" colSpan={compact ? 5 : 7}>{emptyText}</td>
          </tr>
        )}
        {!loading &&
          rows.map((m) => (
            <tr key={m.key}>
              <td className="nl-primary">
                <span className="nl-token">
                  <TokenDot symbol={m.key} />
                  <Link href={`/borrow/${encodeURIComponent(m.key)}`} className="nl-row-link">
                    {m.name}
                  </Link>
                </span>
                <span className="nl-sub">{CATEGORY_LABEL[m.category] ?? m.category} · {m.oracleLabel}</span>
              </td>
              <td className="nl-r" data-label="Total supplied">{amountIn(m.totalSupply, m.loan)}</td>
              <td className="nl-r" data-label="Supply APY">{pct(m.supplyAPR)}</td>
              <td className="nl-r" data-label="Borrow APY">{pct(m.borrowAPR)}</td>
              {!compact && <td className="nl-r" data-label="Available">{amountIn(m.availableToBorrow, m.loan)}</td>}
              <td className="nl-r" data-label="Max LTV">{pct(m.lltv, 1)}</td>
              {!compact && (
                <td className="nl-r" data-label="Status">
                  <StatusChip tone={m.enabled ? "positive" : "warning"} size="sm">{m.enabled ? "Active" : "Paused"}</StatusChip>
                </td>
              )}
            </tr>
          ))}
      </tbody>
    </table>
  );
}
