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

## 2026-10-14 (evening) — Fixed + NETLEND contracts, first testnet deployment

Done
- **Fixed** (`contracts/src/fixed/FixedTermMarket.sol`, GPL-2.0, own code): lender-quoted price per 1 USDG at
  maturity, zero-coupon debt at face, liquidation when unhealthy and after maturity regardless of health, lender
  redemption only from repaid/recovered USDG (first come first served), unfilled offers cancellable, LLTV set and
  liquidation incentive curve identical to Morpho Blue. 12 unit tests. Design and the canhav `fixed_rate_yield`
  worksheet in `docs/fixed-term-markets.md`. Mirrors what REA observed on longbow.cash/fixed
  (`ev_0ea7861e…6a50f`): Morpho Midnight + offer mempool, six markets, one maturity, "lending is locked".
  Midnight itself is BUSL-1.1 and not on testnet, so it is rejected in canhav and replaced.
- **Stake / token** (`token/NetlendToken.sol`, `staking/StakingRewards.sol`, `staking/RevenueSplitter.sol`): NETLEND
  stand-in (cap 1 B, 700 M to treasury, faucet mints the public share), Synthetix-style USDG streams, splitter as the
  vaults' fee recipient (75 % treasury / 25 % stakers). 3 unit tests. Token design in `docs/token-netlend.md`.
- Deploy scripts `Deploy06_Fixed` (4 markets with seed offers) and `Deploy07_Token`; `Deploy02b` WETH seed is now
  `WETH_SEED_WEI` (default 0.002 ETH). Anvil rehearsal + smoke extended (fixed borrow, stake). 32 tests pass.
- **Testnet 46630 deployed** with `scripts/deploy-testnet.sh` (gas is 0.01 gwei; the whole chain cost
  0.0035 (of which 0.002 wrapped into the WETH/USDG pool) ETH of the deployer's 0.01):
  | Contract | Address |
  |---|---|
  | Morpho Blue | `0x0B18F1Ee5a4ecdeA15ec8ccD8cB98BA79728eC36` |
  | AdaptiveCurveIRM | `0x8aA89FCe7DE025607B5240DcBc66A79f4240f9DC` |
  | MetaMorpho factory | `0x16448D3860E39a56DDf5365f145d1e17Bb2D6eC6` |
  | PublicAllocator | `0xb460C75856b868Efaab0Fe8b3765b3595632394b` |
  | netlend USDG Core / Frontier / ETH | `0x99678594A9Ab6f3E66DDBa72D8f74D8C7691FB51` / `0xf5C96a392a90ccA05237751cF1214d0Fc386614d` / `0xb8B4D09D084b32387f04081fb028a2F059B62fbf` |
  | MarketGuard | `0x945970B4f524A8138E095865ae995929a8Fbe60C` |
  | FixedTermMarket | `0xd1a9870790D3D0defC29Dbd97D7aA4675F7972B4` (TSLA-30D, ETH-30D mature 2026-11-13; SPY-90D, SGOV-90D mature 2027-01-12; seed offers 1–4) |
  | NETLEND / StakingRewards / RevenueSplitter | `0x164654C70B6b65dDe6714F596a9DB8c639813cBC` / `0x81f6b0727d6D23603F333f5646a9D1209274371D` / `0x38aF9C9326b032bF8C19f9f7514a53339C1bc466` |
  | Mock USDG / Faucet | `0x5BDD84fb35E40A894C919d8AC3A48649214d40D4` / `0x88e0281B2448d15Ac151072A70237a402CC84d7c` |
  | Uniswap v3 factory | `0xF3977C47bbD8d5710e731fAE339289dEe5fC4150` (9 USDG pools) |

  11 variable markets (`markets.*`), 10 oracles, the whole book in `packages/sdk/addresses.46630.json`.
  Verification: `scripts/verify-testnet.sh` (Blockscout; FixedTermMarket verified first, the rest of the broadcasts in a second pass).
- SDK: ABIs for FixedTermMarket / NetlendToken / StakingRewards / RevenueSplitter, `AddressBook` types for
  `fixed` and `token`.
- canhav proposals (propose mode, accept in Studio → Agent changes): template decisions `9b346e8d…`, features
  `d99cacb5…`, ideas `4c18793a…`, architecture `02b1191c…`, stage `testnet_deployed` + `testnetContracts` and the build-step ticks (see Agent changes).
- canhav token: the MCP cannot create or link a token design. **Owner action:** start a token design on the project
  page in the studio (name `netlend`, ticker `NETLEND`), then the agent pushes `docs/token-netlend.md` into it with
  `update_linked_token_design`.

Next
1. Accept the canhav proposals; link a NETLEND token design in the studio so the token build steps unlock.
2. Web: `/fixed` (markets, offers, lend/borrow) and `/stake` pages on top of the new ABIs; readers in the SDK.
3. Phase 3 services (liquidator incl. fixed maturities, watchdog), then Multiply (Bundler3), NFT escrow, MCP.

Lessons recorded
- The public 46630 RPC is load-balanced over nodes that lag a few blocks; forge simulation then fails with
  "unsupported block number" / "failed to get block number". `scripts/deploy-testnet.sh` retries and, because forge
  writes the address book during simulation, snapshots and restores the book around every step. Without that, a
  failed simulation left `oracles.twapFactory` pointing at a nonce the Uniswap factory later consumed, and the
  code-presence check in `AddressBook._get` was fooled (Deploy03 reverted calling `create` on the Uniswap factory).
- Verification is a separate pass (`scripts/verify-testnet.sh`) so Blockscout latency never stalls a broadcast.
