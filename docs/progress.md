# Progress log

## 2026-10-14 — Phase 0 + Phase 1 + first slice of Phase 2/3

Done
- canhav Basics proposal sent (change c330f435…). Waiting for the owner to accept it in the studio; until then the
  resource pack, build steps, templates and prelaunch review stay locked.
- Repo scaffold: pnpm workspace, Foundry project with upstream Morpho Blue v1.0.0, MetaMorpho v1.1, Bundler3,
  oracles v2.0.0, IRM v1.1.0, PublicAllocator v1.0.0, OZ v5.7.0, Uniswap v3 core/periphery (+ vendored npm artifacts).
- Contracts: mocks (USDG, stock tokens with uiMultiplier/pause/block, 24/5 feed wrapper, faucet, NFTs), TWAP oracle +
  factory, MarketGuard (watchdog curator), compiler-version anchors so upstream pinned pragmas coexist.
- Deploy scripts 00–05 (local WETH, core, substitutes, Uniswap + seeded pools, oracles, 11 markets, 3 vaults + guard),
  idempotent through `packages/sdk/addresses.<chain>.json`, with code-presence checks.
- Tests: 17 passing (unit + full-stack integration: earn → borrow → liquidate → weekend freeze → watchdog trip →
  TWAP pricing → zero-fee flash loan).
- Anvil rehearsal of the whole chain (`scripts/rehearse-anvil.sh`) and an on-chain smoke (`scripts/smoke-anvil.sh`).
- API (`apps/api`): /api/markets, /api/markets/:key, /api/v2/vaults, /api/stats, /api/addresses, /api/health.
- Web (`apps/web`): Home, Earn (vault deposit/withdraw), Borrow list, Market page (supply collateral, borrow, repay,
  health factor, liquidation price, interface safe-cap), Portfolio, Faucet button.

Lessons recorded
- Robinhood testnet has WETH, Multicall3, Permit2, CreateX and the ERC-6551 registry, nothing else we need.
- MetaMorpho factory only fits under the 24 KB limit when compiled via-IR (upstream setting); `via_ir = true`.
- A vault deposit fills the first market in the supply queue; liquidity for other markets comes from the allocator
  (`reallocate`) or the PublicAllocator. The borrow flow must account for this (Phase 3: PublicAllocator flow caps).
- Never leave two forge broadcasts running against the same key: the stuck-nonce stall looked like a node bug.

Next
1. Owner accepts the canhav Basics proposal → read resource pack / build steps / templates, record decisions.
2. Fund the deployer (address in `.env`, `DEPLOYER_ADDRESS`) from the Robinhood testnet faucet, then run the runbook.
3. Phase 3: liquidator + watchdog services, PublicAllocator flow caps, canhav Architecture/Security proposals.
4. Phase 4: Bundler3 Multiply; Phase 5: token via canhav + StakingRewards; Phase 6 NFT; Phase 7 Fixed; Phase 8 MCP.

## 2026-10-14 (afternoon) — netlend.finance rename, Next.js frontend, GitHub + Vercel, canhav wallet record

Done
- Renamed crednet2 → **netlend.finance** everywhere: root package, `@netlend/sdk`, `@netlend/web`, vault names
  "netlend USDG Core / USDG Frontier / ETH" (`nlUSDG`, `nlUSDGf`, `nlETH`) in `markets.json`, Deploy05 and the
  FullStack test, NatSpec, docs. The canhav project is called `netlend.lending` (renamed by the owner).
- Replaced the Vite app and the Hono API with one Next.js 16 app in `apps/web`, built from the netlend.finance
  design system (artifact `DQe6QEsjSe2hbmJSTv2Jyi`; copies in `apps/web/design/`): landing `/`, `/earn`, `/borrow`,
  `/borrow/[key]`, `/portfolio`, `/dev/components`; read API as route handlers with the same Longbow-shaped
  responses (`/api/markets`, `/api/markets/:key`, `/api/v2/vaults`, `/api/stats`, `/api/addresses`, `/api/health`).
  Injected wallet only (no RainbowKit), light + dark themes, skeletons / "Coming soon" until contracts exist.
- Chain readers moved into `packages/sdk/src/readers/` as pure functions (client, book, registry) so the web app
  and the future MCP server share them; `format.ts` and `health.ts` hold the brand's number rules and the
  Healthy ≥1.50 / Caution 1.10–1.49 / At risk <1.10 bands. Fixed `chains.ts` multicall3 (`0xcA11…`, not `0xa432…`).
- Verified: `next build`, 17 forge tests, full Anvil rehearsal + smoke (deposit, reallocate, TSLA borrow), pages in
  light/dark and at 375px. Wallet writes were exercised with `cast` in the smoke script, not through a browser wallet.
- Repo: https://github.com/wazarat/netlend.finance (pushed over HTTPS; the SSH key on this Mac is not registered
  with GitHub). Vercel project `netlend-finance` (team "Wazarat's projects", root `apps/web`), production alias
  https://netlend-finance-wazarats-projects.vercel.app, env `NEXT_PUBLIC_CHAIN=46630` + RPC + explorer.
- canhav: the platform had **no record of the deployer**; the slot is the verification field `verifyWallet`.
  Proposal `276d7907-4f0b-4aa1-a228-428f0e343b67` sets `verifyWallet` = deployer, `githubRepo` =
  `wazarat/netlend.finance` and renames `whatItDoes` to netlend.finance. Accept it in Studio → Agent changes.
  `testnetContracts` + `stage: testnet_deployed` follow once Deploy01–05 have run.

Testnet status (corrected)
- Nothing is on 46630 yet: `addresses.46630.json` is empty and the deployer (`DEPLOYER_ADDRESS` in `.env`) holds
  0.01 ETH at nonce 0. Steps 1–5 need about 0.65 ETH (0.15 gas + 0.5 wrapped for the WETH/USDG pool).

Next
1. Fund the deployer, run `docs/runbook-testnet.md` steps 1–5, commit `packages/sdk/addresses.46630.json`;
   Vercel redeploys on push and the site switches from "Coming soon" to live figures.
2. canhav: propose `stage: testnet_deployed` + `testnetContracts` (Morpho, MetaMorpho factory, 3 vaults,
   MarketGuard, faucet, USDG); then the Architecture step (`contracts`, `oracles`, `externalDeps`,
   `upgradeability`), which is the current `firstProblem`.
3. Phase 3: liquidator + watchdog services, PublicAllocator flow caps, rate history (no chart until there is data).
4. Phase 4: Bundler3 Multiply; Phase 5: token via canhav + StakingRewards; Phase 6 NFT; Phase 7 Fixed; Phase 8 MCP.
