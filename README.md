# netlend.finance

A curated credit layer for **Robinhood Chain testnet** (chain id 46630), modelled on
[longbow.cash](https://www.longbow.cash): Earn (curated vaults), Borrow (isolated Morpho Blue markets),
Multiply (atomic leverage), Fixed (fixed-term USDG markets), NFT lending (escrow), Stake (protocol token
paid in USDG), zero-fee flash loans, on-chain credit scores and an MCP server for agents.

Product definition lives in the [canhav Studio](https://canhav.com) project `netlend.lending`; the build plan and
the reverse-engineering ledger are in `docs/`. The visual design comes from the netlend.finance design system,
saved in `apps/web/design/` (`BRAND.md`, `BUILD.md`, `reference.css`).

## Layout

| Path | What |
|---|---|
| `contracts/` | Foundry. Upstream Morpho Blue / MetaMorpho / Bundler3 / oracles / IRM (GPL-2.0) as submodules, plus ours: `fixed/FixedTermMarket` (Fixed), `token/NetlendToken` + `staking/StakingRewards` + `staking/RevenueSplitter` (Stake), `guard/MarketGuard` (watchdog), `oracles/UniV3Twap*`, `mocks/*`. Planned: NFT escrow, credit registry. |
| `packages/sdk/` | Chain definition, `addresses.46630.json` / `addresses.local.json`, `markets.json` registry, generated ABIs, and the pure viem readers (`readMarkets`, `readVaults`, `computeStats`), formatting and health-factor maths shared by the web app and the future MCP server. |
| `apps/web/` | Next.js 16 app: marketing landing, `/earn`, `/borrow`, `/borrow/[key]`, `/portfolio`, `/dev/components`, and the read API as route handlers (`/api/markets`, `/api/markets/:key`, `/api/v2/vaults`, `/api/stats`, `/api/addresses`, `/api/health`). Deploys to Vercel with root directory `apps/web`. |
| `apps/mcp/` | (planned) Streamable-HTTP MCP server: read tools + build-unsigned-tx tools. Never signs. |
| `services/` | (planned) Watchdog (oracle divergence → cap 0), liquidator, credit-score indexer, merkle publisher. |
| `scripts/` | `rehearse-anvil.sh` (full deploy on Anvil → `addresses.local.json`), `smoke-anvil.sh`, `deploy-testnet.sh`, `verify-testnet.sh`, `export-abis.sh`. |
| `docs/` | `progress.md`, `runbook-testnet.md`, `longbow-ledger.md` (what we mirror and why), `fixed-term-markets.md` (Fixed design + canhav worksheet), `token-netlend.md` (NETLEND token design). |

## Network

```
RPC       https://rpc.testnet.chain.robinhood.com
Chain id  46630
Explorer  https://explorer.testnet.chain.robinhood.com  (Blockscout)
Faucet    https://faucet.testnet.chain.robinhood.com
```

Present on testnet (probed 2026-10-14): WETH, Multicall3, Permit2, CreateX, ERC-6551 registry.
Absent: Morpho, Uniswap v3, USDG, Chainlink stock feeds, Stock Tokens → see `packages/sdk/probe.46630.json`.

## Quick start

```bash
cp .env.example .env            # fill PRIVATE_KEY from the faucet-funded deployer
pnpm install
cd contracts && forge build && forge test && cd ..

# Web app against the testnet address book (empty until the runbook has run)
pnpm web:dev                    # http://localhost:3000

# Web app against a local Anvil rehearsal with real positions
scripts/rehearse-anvil.sh && scripts/smoke-anvil.sh
NEXT_PUBLIC_CHAIN=local NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545 pnpm web:dev
```

Web environment variables are listed in `apps/web/.env.example`. Restart `next dev` after a rehearsal: the
address book is imported statically.
