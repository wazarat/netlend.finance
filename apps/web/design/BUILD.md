# Build guide for Claude Code

Hand this section to Claude Code to build the first version of netlend.finance, a marketing site plus a lending app shell. The product shape follows lending layers such as Longbow (lend a stablecoin, borrow against tokenized stocks, real-world assets and other collateral). The visual design is netlend's own and comes only from this system. Do not copy another protocol's layout, copy or assets.

## 1. Before you start

1. Create a folder for the project and open Claude Code in it.
2. From this design system, download into the project.
   - `fonts/Manrope-Variable.woff2` and `fonts/Inter-Variable.woff2` into `public/fonts/` (Typography view).
   - `netlend-logo.png`, `netlend-icon.png` and `netlend-wordmark.png` into `public/brand/` (Assets view, Logos group).
   - `components/bundle.css` from the Files view into `design/reference.css`. It is the reference styling for every component.
   - This section saved as `design/BUILD.md`, and the README section saved as `design/BRAND.md`.
3. Paste the prompt from section 9 into Claude Code.

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) with TypeScript, current stable |
| Styling | Tailwind CSS v4 reading the CSS variables below, plus plain CSS modules where clearer |
| Fonts | `next/font/local` with the two variable woff2 files |
| Icons | `lucide-react`, stroke width 1.5 |
| Wallet | wagmi v2 + viem + RainbowKit, themed with the tokens (custom theme, `primary` accent, `radius-lg` modal) |
| Data | TanStack Query over a typed `lib/data` layer that returns mock data until contracts are live |
| Hosting | Vercel |

## 3. Tokens as CSS

Put this in `app/globals.css`. It is `tokens.json` compiled. Never hard-code a hex value in a component; use the variables.

```css
@font-face { font-family: "Manrope"; src: url("/fonts/Manrope-Variable.woff2") format("woff2"); font-weight: 200 800; font-display: swap; }
@font-face { font-family: "Inter"; src: url("/fonts/Inter-Variable.woff2") format("woff2"); font-weight: 100 900; font-display: swap; }

:root, [data-theme="light"] {
  --deep-moss: #243A33; --pine-slate: #31463F; --shadow-sage: #5E746A;
  --soft-stone: #F3F0EA; --mist-grey: #D9DDD8; --carbon: #161A18;
  --bg: var(--soft-stone); --surface: #FCFBF8; --surface-muted: #E6E8E3;
  --border: var(--mist-grey); --border-control: #7C8A83;
  --ink: var(--carbon); --ink-muted: #535C57;
  --primary: var(--deep-moss); --primary-hover: var(--pine-slate); --on-primary: var(--soft-stone);
  --accent: var(--shadow-sage);
  --positive: #206444; --positive-soft: #E6F0E8;
  --warning: #85560F; --warning-soft: #F7EEDC;
  --negative: #A3362F; --negative-soft: #FBEDEC;
  --focus-ring: var(--pine-slate);
  --shadow-card: 0 1px 2px rgba(22,26,24,.04), 0 8px 24px rgba(22,26,24,.05);
  --shadow-button: 0 1px 2px rgba(22,26,24,.12), inset 0 1px 0 rgba(255,255,255,.08);
  --shadow-pop: 0 12px 32px rgba(22,26,24,.12);
}
[data-theme="dark"] {
  --bg: #121715; --surface: #1A211E; --surface-muted: #26302B;
  --border: #2E3833; --border-control: #66736C;
  --ink: #F3F0EA; --ink-muted: #A7B1AB;
  --primary: #A9C2B5; --primary-hover: #BFD3C8; --on-primary: var(--carbon);
  --accent: #8FA89B;
  --positive: #7FC4A0; --positive-soft: #1C3328;
  --warning: #E6BE7A; --warning-soft: #3A2F1C;
  --negative: #F0A39C; --negative-soft: #3A2220;
  --focus-ring: #CFE0D6;
  --shadow-card: 0 1px 2px rgba(0,0,0,.3); --shadow-button: none; --shadow-pop: 0 12px 32px rgba(0,0,0,.5);
}
:root {
  --font-display: "Manrope", "Inter", system-ui, sans-serif;
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 96px;
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-pill: 999px;
  --content-max: 1200px; --header-height: 64px; --control-height: 44px; --panel-width: 400px;
}
```

Light is the default. Ship the dark theme behind a toggle in the footer that sets `data-theme` on `<html>` and remembers the choice.

Type scale (Manrope for display and headings, Inter for the rest).

| Style | Size / line | Weight | Tracking |
|---|---|---|---|
| display-xl | 64 / 68 | 700 | -0.03em |
| display-lg | 44 / 48 | 700 | -0.025em |
| heading-1 | 32 / 40 | 700 | -0.02em |
| heading-2 | 24 / 32 | 600 | -0.01em |
| heading-3 | 18 / 26 | 600 | 0 |
| body-lg | 17 / 28 | 400 | 0 |
| body | 15 / 24 | 400 | 0 |
| body-sm | 13 / 20 | 400 | 0 |
| label | 14 / 20 | 500 | 0 |
| eyebrow | 12 / 16 uppercase | 500 | 0.18em |
| figure-lg | 28 / 34 tabular | 600 | -0.01em |
| figure | 15 / 24 tabular | 500 | 0 |

On mobile scale display-xl to 40/44 and display-lg to 32/38.

## 4. Project structure

```
app/
  layout.tsx            fonts, theme attribute, providers
  page.tsx              landing page
  markets/page.tsx      markets list
  markets/[symbol]/page.tsx  market detail + action panel
  dashboard/page.tsx    user positions
components/ui/          Button, StatusChip, Card, MetricTile, AmountInput, Tabs
components/lending/     MarketsTable, ActionPanel, HealthFactor
components/layout/      AppHeader, MarketingHeader, Footer, Container
lib/data/               types.ts, markets.ts (mock), positions.ts (mock)
lib/format.ts           money, percent, token amount, address
lib/health.ts           health factor maths and bands
config/chain.ts         chain id, RPC, explorer, contract addresses (env vars)
```

## 5. Components

Port each component from `design/reference.css` (class names start with `nl-`) into a typed React component. Previews and usage rules for each are in this system's Components view.

| Component | Props | Notes |
|---|---|---|
| Button | `variant: "primary" \| "secondary" \| "ghost"`, `size: "md" \| "sm"`, `block`, `loading`, `icon`, `iconPosition` | Pill. Disabled label states the reason. |
| StatusChip | `tone: "positive" \| "warning" \| "negative" \| "neutral"`, `children` | Dot plus word, always both. |
| Card | `icon?`, `title`, `children`, `href?` | `surface`, hairline, `radius-lg`, `shadow-card`. |
| MetricTile | `label`, `value`, `sub?`, `loading?` | Skeleton while loading, never a fake value. |
| AmountInput | `token`, `balance`, `value`, `onChange`, `onMax`, `error?`, `fiatEstimate?` | 56px, tabular numerals, decimals only. |
| Tabs | `items`, `value`, `onChange` | Segmented pill, roving tabindex, arrow keys. |
| MarketsTable | `markets: Market[]`, `filter`, `sort` | Rows link to `/markets/[symbol]`; cards under 720px. |
| HealthFactor | `value: number \| null`, `projected?` | Bands from `lib/health.ts`, `role="meter"`. |
| ActionPanel | `market`, `position`, `mode` | Tabs Supply, Borrow, Repay, Withdraw. Separate Approve step. |
| AppHeader | `active`, `variant: "app" \| "marketing"` | Logo, nav, network chip, wallet button. |

Types to start from.

```ts
export type AssetCategory = "stablecoin" | "tokenized-stock" | "rwa" | "other";
export interface Market {
  symbol: string; name: string; category: AssetCategory; decimals: number;
  priceUsd: number; totalSupplied: bigint; totalBorrowed: bigint;
  supplyApy: number | null; borrowApy: number | null;   // null for collateral-only assets
  maxLtv: number; liquidationThreshold: number;           // 0 to 1
  status: "active" | "paused" | "frozen";
}
export interface Position { symbol: string; supplied: bigint; borrowed: bigint; collateralEnabled: boolean; }
```

Health factor is the sum over collateral of (value in USD times liquidation threshold) divided by total debt in USD. With no debt, return `null` and show "No borrows". Default bands are Healthy at 1.50 and above, Caution from 1.10, At risk below 1.10; keep them in `lib/health.ts` so they can follow the protocol's real risk parameters.

## 6. Pages and sections

**Landing `/`** (see the LandingPage template)
1. Marketing header with Product, Docs, Security and "Launch app".
2. Hero. Eyebrow "Modern infrastructure for open finance", headline "Supply. Borrow. Stay in control.", subcopy, Get started and Learn more buttons, and a stats card (total supplied, total borrowed, stablecoin supply APY).
3. How it works, three cards (Supply, Borrow, Stay in control).
4. Markets preview, top four markets with "View all markets".
5. Supported collateral by category.
6. Security and infrastructure (audits, oracles, risk parameters), each linking to Docs. Only claim audits that exist.
7. FAQ accordion.
8. Footer with links, theme toggle and a one-line risk notice.

**Markets `/markets`** (see the MarketsPage template). Title, description, stats card, Tabs filter (All, Stablecoins, Stocks, RWAs) and search, MarketsTable.

**Market detail `/markets/[symbol]`.** Back link, asset header (icon, name, StatusChip), a facts card (price, total supplied, total borrowed, utilization, max LTV, liquidation threshold, oracle), a rate history chart (line in `accent`, gridlines in `border`, no fills), and ActionPanel on the right, sticky.

**Dashboard `/dashboard`.** Requires a wallet; otherwise show a Card with "Connect your wallet to see positions" and the Connect button. Summary card with net worth, total supplied, total borrowed and HealthFactor, then Your supplies and Your borrows tables with Withdraw and Repay buttons. Empty states point to the next action.

## 7. Rules

- Every colour, radius, space and shadow from the variables in section 3. Every number formatted through `lib/format.ts` with tabular figures.
- Mock data returns obvious placeholders until the contracts are connected. Never ship invented TVL or APY numbers to production; show skeletons or "Coming soon".
- Chain, RPC, explorer and contract addresses come from environment variables in `config/chain.ts`, nothing hard-coded.
- Accessibility. Semantic HTML, visible `focus-ring` on everything focusable, 44px touch targets, labels on all inputs, status always as a word, `prefers-reduced-motion` respected, contrast 4.5:1 for text in both themes.
- Responsive at 375px, 768px, 1280px and 1440px with no horizontal scroll.
- No gradients, no bright blue, no purple, no emoji, no stock illustrations.
- Metadata. Title "netlend.finance", description "Lending infrastructure for a more open financial future.", favicon and Apple touch icon from `netlend-icon.png`, Open Graph image 1200 x 630 built from the Announcement post layout.

## 8. Done when

- All four routes render with mock data in light and dark themes and pass a Lighthouse accessibility score of 95 or more.
- Connecting a wallet on the configured chain works and the header shows the truncated address.
- Supply and Borrow flows run end to end against the mock layer with approval, pending and confirmed states.
- No hard-coded colours in components (grep for `#` in `components/` returns only comments).
- Deploys to Vercel from the main branch.

## 9. Prompt to paste into Claude Code

```
Build the first version of netlend.finance, a lending protocol website and app.

Read design/BRAND.md and design/BUILD.md first and follow them exactly.
Use design/reference.css as the visual reference for every component, and
public/brand and public/fonts for the logo and fonts.

Steps, one commit each:
1. Scaffold Next.js (App Router, TypeScript), Tailwind v4, lucide-react,
   wagmi + viem + RainbowKit, TanStack Query. Add the CSS variables and
   @font-face rules from BUILD.md section 3 to app/globals.css.
2. Build the UI components in BUILD.md section 5 with typed props and a
   /dev/components page that shows every state in light and dark.
3. Build lib/format.ts, lib/health.ts and a mock lib/data layer with
   placeholder markets (a stablecoin, two tokenized stocks, one RWA).
4. Build the pages in BUILD.md section 6.
5. Wire wallet connection with chain settings from environment variables.
6. Check everything in BUILD.md section 8 and list anything not met.

Do not invent protocol numbers, audits or partners. Ask me before adding
any dependency not listed in BUILD.md.
```

## 10. Deploy

Push the repository to GitHub and import it in Vercel (or ask Claude to create the Vercel project). Add the chain environment variables in the Vercel project settings, then point `netlend.finance` at the project from Vercel's Domains tab.
