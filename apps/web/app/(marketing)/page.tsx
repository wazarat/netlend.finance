import { ArrowRight, Landmark, Layers, Plus, Radar, ShieldCheck, Wallet } from "lucide-react";
import { registry } from "@netlend/sdk";
import { Button, Card, StatusChip } from "@/components/ui";
import { REPO_URL } from "@/components/layout";
import { book } from "@/config/chain";
import { HeroStats, MarketsPreview } from "./LandingData";

const CATEGORIES: Array<{ id: string; title: string; body: string }> = [
  { id: "Stocks", title: "Tokenized stocks", body: "Priced by 24/5 Chainlink-style feeds that pause outside market hours." },
  { id: "RWA", title: "Real-world assets", body: "Treasury and gold tokens with the highest loan-to-value tiers." },
  { id: "Crypto", title: "Crypto", body: "WETH against USDG, and USDG as margin to short ETH." },
  { id: "Memes", title: "Long-tail tokens", body: "Priced by 30-minute Uniswap v3 TWAPs, capped small, in their own vault." },
];

const FAQ: Array<[string, string]> = [
  ["What is netlend.finance?", "A lending protocol on Robinhood Chain. You supply USDG or WETH to a curated vault and earn a variable rate, or post collateral in an isolated market and borrow against it."],
  ["Is this real money?", "No. This deployment runs on Robinhood Chain testnet with mock tokens from the faucet. Nothing here has value."],
  ["How are rates set?", "Each market uses an adaptive-curve interest rate model. The borrow rate moves with utilisation, and suppliers earn that rate less a 10% performance fee. Every rate shown is variable."],
  ["What is the health factor?", "Collateral value times the market's liquidation LTV, divided by your debt. Below 1.00 the position can be liquidated. We call 1.50 and above Healthy, 1.10 to 1.49 Caution and below 1.10 At risk."],
  ["Who holds my funds?", "The contracts do. Vaults are MetaMorpho ERC-4626 vaults and markets settle on an unmodified Morpho Blue deployment. The curator can only move liquidity between whitelisted markets inside caps that sit behind a timelock."],
];

export default function LandingPage() {
  const grouped = CATEGORIES.map((c) => ({ ...c, markets: registry.markets.filter((m) => m.category === c.id) }));
  return (
    <>
      <section className="nl-container nl-section grid items-center gap-10 desktop:grid-cols-[1.2fr_1fr] desktop:gap-12">
        <div>
          <div className="t-eyebrow">Modern infrastructure for open finance</div>
          <h1 className="t-display-xl mt-4">Supply. Borrow. Stay in control.</h1>
          <p className="t-body-lg nl-muted mt-5 mb-8 max-w-[460px]">
            Lend stablecoins and borrow against the assets you already hold, with clear rates and a health factor you can read at a glance.
          </p>
          <div className="nl-row">
            <Button href="/earn" icon={ArrowRight} iconPosition="end">
              Get started
            </Button>
            <Button href="#how" variant="secondary">
              Learn more
            </Button>
          </div>
        </div>
        <HeroStats />
      </section>

      <section id="how" className="nl-container nl-section pt-0">
        <div className="t-eyebrow">How it works</div>
        <div className="mt-5 grid gap-6 tablet:grid-cols-3">
          <Card icon={Layers} title="Supply">
            <p className="nl-card__body">Deposit USDG or WETH into a curated vault and earn a variable rate from borrowers.</p>
          </Card>
          <Card icon={Wallet} title="Borrow">
            <p className="nl-card__body">Post tokenized stocks, real-world assets or crypto in an isolated market and borrow against it.</p>
          </Card>
          <Card icon={ShieldCheck} title="Stay in control">
            <p className="nl-card__body">Watch your health factor, add collateral or repay any time, and read every parameter on chain.</p>
          </Card>
        </div>
      </section>

      <section className="nl-container nl-section pt-0">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <div className="t-eyebrow">Markets</div>
            <h2 className="t-h2 mt-2">Largest markets</h2>
          </div>
          <Button href="/borrow" variant="secondary" size="sm">
            View all markets
          </Button>
        </div>
        <MarketsPreview />
      </section>

      <section className="nl-container nl-section pt-0">
        <div className="t-eyebrow">Supported collateral</div>
        <div className="mt-5 grid gap-6 tablet:grid-cols-2">
          {grouped.map((c) => (
            <Card key={c.id} title={c.title}>
              <p className="nl-card__body mb-3">{c.body}</p>
              <div className="flex flex-wrap gap-2">
                {c.markets.map((m) => (
                  <StatusChip key={m.key} tone={book.markets[m.key] ? "positive" : "neutral"} size="sm">
                    {m.collateral} · LLTV {Math.round(m.lltv * 1000) / 10}%
                  </StatusChip>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section id="security" className="nl-container nl-section pt-0">
        <div className="t-eyebrow">Security and infrastructure</div>
        <div className="mt-5 grid gap-6 tablet:grid-cols-3">
          <Card icon={Landmark} title="Isolated markets">
            <p className="nl-card__body">
              Markets settle on an unmodified Morpho Blue deployment. Each has its own oracle, liquidation LTV and supply cap, so one bad asset
              cannot socialise losses.
            </p>
          </Card>
          <Card icon={Radar} title="Oracles">
            <p className="nl-card__body">
              Equities use 24/5 feeds that pause outside market hours. Long-tail tokens use 30-minute Uniswap v3 TWAPs. A watchdog can cap a
              market to zero when a feed and the market disagree.
            </p>
          </Card>
          <Card icon={ShieldCheck} title="Risk parameters">
            <p className="nl-card__body">
              Liquidation LTV tiers from 38.5% to 91.5%, per-market caps and a one-day timelock on vault changes. Every parameter is readable on
              chain.
            </p>
          </Card>
        </div>
        <p className="t-body-sm nl-muted mt-5 max-w-[72ch]">
          Testnet deployment. The upstream Morpho Blue and MetaMorpho contracts carry their authors&apos; audits; netlend&apos;s own contracts (oracles,
          market guard, mocks) are not audited yet. Source is public at{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            github.com/wazarat/netlend.finance
          </a>
          .
        </p>
      </section>

      <section id="faq" className="nl-container nl-section pt-0">
        <div className="t-eyebrow">Questions</div>
        <div className="mt-5 max-w-[760px]">
          {FAQ.map(([q, a]) => (
            <details key={q} className="nl-faq">
              <summary>
                {q}
                <Plus aria-hidden="true" strokeWidth={1.5} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
          <hr className="nl-divider" />
        </div>
      </section>
    </>
  );
}
