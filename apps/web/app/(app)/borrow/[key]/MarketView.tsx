"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { amountIn, money, pct, price as fmtPrice, registry } from "@netlend/sdk";
import { Button, CopyAddress, Skeleton, StatusChip, TokenDot } from "@/components/ui";
import { MarketPanel, MARKET_MODES, type MarketMode } from "@/components/lending";
import { marketStatus } from "@/components/lending/MarketsTable";
import { addressUrl, deployed } from "@/config/chain";
import { useMarket } from "@/lib/data/queries";

const CATEGORY_LABEL: Record<string, string> = { Stocks: "Tokenized stock", RWA: "Real-world asset", Crypto: "Crypto", Memes: "Long-tail token", Short: "Short" };

export function MarketView({ marketKey }: { marketKey: string }) {
  const market = useMarket(marketKey);
  const sp = useSearchParams();
  const tab = sp.get("tab");
  const initialMode = (MARKET_MODES as string[]).includes(tab ?? "") ? (tab as MarketMode) : "supply";
  const reg = registry.markets.find((x) => x.key === marketKey);
  const m = market.data;

  if (!reg && !market.isLoading && !m) {
    return (
      <>
        <Link href="/borrow" className="inline-flex items-center gap-2 t-label nl-muted mb-4">
          <ArrowLeft aria-hidden="true" width={16} height={16} strokeWidth={1.5} /> All markets
        </Link>
        <h1 className="t-h1">Unknown market</h1>
        <p className="nl-muted mt-2">There is no market called {marketKey}.</p>
      </>
    );
  }

  const name = m?.name ?? reg?.name ?? marketKey;
  const category = m?.category ?? reg?.category ?? "";
  const status = m ? marketStatus(m) : null;

  return (
    <>
      <Link href="/borrow" className="inline-flex items-center gap-2 t-label nl-muted mb-4">
        <ArrowLeft aria-hidden="true" width={16} height={16} strokeWidth={1.5} /> All markets
      </Link>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <TokenDot symbol={marketKey} size="lg" />
        <h1 className="t-h1">{name}</h1>
        {status ? <StatusChip tone={status.tone}>{status.text}</StatusChip> : !market.isLoading && <StatusChip tone="neutral">Coming soon</StatusChip>}
        <span className="t-body-sm nl-muted">{CATEGORY_LABEL[category] ?? category}</span>
      </div>

      <div className="nl-market-layout">
        <div className="nl-stack" style={{ gap: "var(--space-5)" }}>
          {m?.tradingOpen === false && (
            <div className="nl-notice nl-notice--neutral">
              Stock market closed. The 24/5 feed holds the last print until trading reopens, so the collateral price above is Friday&apos;s close. Borrowing, repaying and liquidations keep working against that frozen price; expect a gap when the market reopens.
            </div>
          )}
          {m?.tripped && (
            <div className="nl-notice nl-notice--warning">
              Capped by the watchdog. A vault&apos;s cap for this market was cut to zero after an oracle check, so vaults stop adding liquidity here. Borrowing is limited to what is already in the market; repay and withdraw are unaffected.
            </div>
          )}
          <section className="nl-card" aria-labelledby="facts">
            <h2 id="facts" className="t-h3 mb-4">Market facts</h2>
            {market.isLoading && <Skeleton width="60%" height="20px" />}
            {market.isError && !m && (
              <div className="nl-notice nl-notice--negative" role="alert">
                Could not read this market from the chain. Check the RPC and try again.
              </div>
            )}
            {!market.isLoading && !m && !market.isError && (
              <p className="nl-muted m-0">
                {deployed ? "This market has not been created on chain yet." : "Contracts are not on testnet yet. The market opens once Deploy04 runs."}
                {reg && ` Planned: ${reg.collateral} collateral, ${reg.loan} loan, LLTV ${pct(reg.lltv, 1)}, cap ${money(reg.capUsdg)}.`}
              </p>
            )}
            {m && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 tablet:grid-cols-3 m-0">
                <Fact label="Collateral price" value={fmtPrice(m.price, m.loan)} />
                <Fact label="Total supplied" value={amountIn(m.totalSupply, m.loan)} />
                <Fact label="Total borrowed" value={amountIn(m.totalBorrow, m.loan)} />
                <Fact label="Utilisation" value={pct(m.utilization)} />
                <Fact label="In the market now" value={amountIn(m.availableToBorrow, m.loan)} />
                <Fact label="Pullable from vaults" value={amountIn(m.reallocatable, m.loan)} />
                <Fact label="Supply cap" value={amountIn(m.cap, m.loan)} />
                <Fact label="Supply APY" value={`${pct(m.supplyAPR)} variable`} />
                <Fact label="Borrow APY" value={`${pct(m.borrowAPR)} variable`} />
                <Fact label="Liquidation LTV" value={pct(m.lltv, 1)} />
                <Fact label="Oracle" value={m.oracleLabel} />
                <Fact label="Rate model" value={m.irm} />
              </dl>
            )}
          </section>
          {m && (
            <section className="nl-card" aria-labelledby="addresses">
              <h2 id="addresses" className="t-h3 mb-4">Addresses</h2>
              <dl className="nl-stack m-0" style={{ gap: "var(--space-3)" }}>
                <div className="nl-kv"><dt>Market id</dt><dd><CopyAddress address={m.marketId} /></dd></div>
                <div className="nl-kv"><dt>Collateral token</dt><dd><CopyAddress address={m.collateralAddress} href={addressUrl(m.collateralAddress)} /></dd></div>
                <div className="nl-kv"><dt>Loan token</dt><dd><CopyAddress address={m.loanAddress} href={addressUrl(m.loanAddress)} /></dd></div>
                <div className="nl-kv"><dt>Oracle</dt><dd><CopyAddress address={m.oracle} href={addressUrl(m.oracle)} /></dd></div>
              </dl>
            </section>
          )}
          {m?.isShort && (
            <div className="nl-notice nl-notice--neutral">Short market: post USDG as margin, borrow WETH and sell it. Buy WETH back to repay.</div>
          )}
        </div>
        {m ? (
          <MarketPanel m={m} initialMode={initialMode} />
        ) : (
          <section className="nl-panel" aria-label="Actions">
            <p className="nl-muted m-0">{market.isLoading ? "Loading market" : "Actions open once the market is live."}</p>
            <Button href="/earn" variant="secondary">Go to Earn</Button>
          </section>
        )}
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="nl-metric">
      <dt className="nl-metric__label">{label}</dt>
      <dd className="t-figure m-0">{value}</dd>
    </div>
  );
}
