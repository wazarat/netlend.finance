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
  `d99cacb5…`, ideas `4c18793a…`, architecture `02b1191c…`, stage `testnet_deployed` + `testnetContracts` `1318c1b3…`, 19 build-step ticks + 2 custom steps `058f5717…`, and 20 custom steps for open decisions and pages to build `fce5a030…`. All still **proposed**: the studio shows 0/30 until they are accepted.
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

## 2026-10-14 (night) — canhav catch-up after M80–M87

- All seven afternoon proposals were accepted by the owner; build steps 19/52, review 0/19, firstProblem moved to the
  security step.
- New proposals (propose mode): reality `firstHundredUsers` `f7db7d79…`, references (+5: REA /fixed capture, both
  design docs, address book, runbook) `a5bc0dca…`, security (worstCase lose_funds, audit/keyCustody not_yet, bug
  bounty/monitoring/incident response planned) `57d3e459…`, review verdicts (environment pass, clarity pass,
  sy-conformance na, cross-protocol na) `9f0d8e5d…`.
- `check_design` validates the NETLEND design once every field is present; advisor cliff moved 6 → 9 months to clear
  the `unlock_cluster` warning; anti-sniping set to the launcher's tax window. See `docs/token-netlend.md`.
- Still blocked in this session: the canhav connection serves the pre-M80 tool list (25 tools) and the server
  answers `robinhood-stock-tokens` as unknown, so `create_linked_token_design`, labelled `testnetContracts`,
  per-step evidence and not-applicable steps wait for a reconnect (`/mcp` → canhav → Reconnect, new session).

Later the same night (after the canhav deploy of M80–M87)
- Server confirmed on the new build: `get_project_status` / `check_project` return `source: projected` with a
  `pending` block, and `robinhood-stock-tokens` is now decidable → proposal `1765a450…` (accepted template).
- Security resent without notes (`6d320fac…`) because the rules accept a note only on "already in place"; the owner
  should **reject `57d3e459…`** and accept `6d320fac…`, otherwise the projection keeps the old notes and
  `check_project` stays on "Audit accepts a note only for already in place".
- Blocked by the client, not the server: this Claude session cached the pre-M80 tool list (25 tools). Unknown
  fields (`evidence`, `notApplicable`) reach the server as strings ("evidence must be an array … max 200"), labelled
  `testnetContracts` rows fail client-side validation, and `create_linked_token_design` / `report_session` are not
  callable. **A new session fixes all four.** Server-side caps learned: evidence and N/A reason ≤ 200 chars each.

To run in the next session (plan /Users/wazarat/.claude/plans/i-voiced-your-concerns-rosy-rain.md, steps 1–3, 6)
1. `report_session` start; `create_linked_token_design` from `docs/token-netlend.md` (advisor cliff 9 m,
   anti-sniping tax); `check_design`; `get_token_build_steps` → tick design steps with evidence.
2. `update_project` `testnetContracts` as `{label,address}` rows from `packages/sdk/addresses.46630.json` + the
   GitHub address-book link.
3. `set_build_steps`: evidence (≤200 chars each) on the 19 ticked + 2 custom steps; `notApplicable` for
   `fixed_rate_yield.wrapper` (untick first) and `fixed_rate_yield.exchange-rate`.
4. `report_session` done.

## 2026-10-14 (late night) — canhav catch-up executed in a fresh session (M80+ tools live)

- A new Claude session serves the M80–M87 tool list, so the four blocked items went through (all **proposed**,
  session `b26cc57d…` visible at the top of Agent changes):
  - Token design **created and linked** by the agent (`create_linked_token_design`, design id `0eb42a9c…`,
    https://www.canhav.com/studio/token/0eb42a9c-f793-4edb-977e-c32cb6454eff). Fields from `docs/token-netlend.md`
    in proposal `d3e7df24…`; governance notes cleared in `017315b2…` (the rules accept a note only for
    "already in place", same as security). `check_design` → **valid**, no warnings; deployability unchanged
    (LP lock, multi-cohort vesting, clawback are stated commitments). Eight design steps ticked with evidence
    `b64b9e03…` (token build 9/16 projected).
  - `testnetContracts` replaced by **49 labelled rows** + `addressBook` link to `packages/sdk/addresses.46630.json`
    on GitHub: `528750fd…`.
  - Build steps `850fab63…`: `custom.fixed_rate_yield.1` and `custom.curated_vault.1` ticked,
    `fixed_rate_yield.wrapper` unticked. **Platform gap:** the call carried `evidence` for 20 steps and
    `notApplicable` for wrapper + exchange-rate, the server answered `proposed`, but the stored patch holds only
    `add/done/remove/undone/restore` (same for the token steps `b64b9e03…`: 8 ticks, no evidence). Propose mode drops
    both new fields; they must be resent (evidence-only call, no ticks) once the server keeps them. Strings are in
    the plan file `~/.claude/plans/continue-with-the-canhav-snappy-mist.md` and in this session's transcript.
- The old security proposal `57d3e459…` was **withdrawn by the agent** (`withdraw_changes`, M88, new in this
  session), so it left the projection and the owner never has to reject it. **Owner action in Studio → Agent
  changes:** accept `6d320fac…`, `f7db7d79…`, `a5bc0dca…`, `9f0d8e5d…`, `1765a450…`, `d3e7df24…`, `017315b2…`,
  `b64b9e03…`, `850fab63…`, `528750fd…`.
- Lessons: `create_linked_token_design` creates the blank design immediately (undoable in the studio) and proposes
  the fields; an empty `note: ""` clears a note through the projection; evidence strings must fit 200 chars; the
  projected `get_build_steps` applies ticks but never shows `evidence` or `na` state, so read `get_agent_changes`
  and inspect the stored `patch` to know what a proposal really carries.

Next
1. Owner accepts the ten proposals above; report the dropped evidence/N/A fields to the canhav dev, then resend them.
2. `get_prelaunch_review` and the remaining review passes.
3. Web: `/fixed` and `/stake` pages (custom steps `fixed_rate_yield.6/7`, `curated_vault.5`), SDK readers.
4. Phase 3 services, Multiply (Bundler3), NFT escrow, MCP server.

## 2026-10-14 (late night, 2) — Earn vault page + Borrow liquidity routing

Done
- **Liquidity routing** (the Borrow gap: deposits only fill the first market in the supply queue):
  `contracts/script/Deploy05b_FlowCaps.s.sol` opens PublicAllocator flow caps on every vault market (reads vault lists
  from `markets.json`, idempotent); `script/lib/PublicAllocatorTypes.sol` is an ABI-identical interface over our Morpho
  types (the upstream one vendors its own `Id`/`MarketParams`). Run on Anvil and **on 46630** (core 7 / frontier 3 /
  eth 2 markets, deployer balance 0.0065 ETH after). New FullStack test
  `test_public_allocator_pulls_liquidity_into_the_borrow_market` (33 tests pass); `smoke-anvil.sh` step 2b now pulls
  through the PublicAllocator as a plain user instead of the allocator key.
- **SDK**: `readVaults` now reads the vault's real position per market (shares → assets), vault `config`/`pendingCap`,
  MarketGuard trip flags, PublicAllocator `isAllocator`/`fee`/`admin`/`flowCaps`, both queues, owner/guardian/
  skimRecipient/pendingTimelock/pendingGuardian/lostAssets; APY is weighted by real allocation. `readMarkets` adds
  `raw` totals, `tradingOpen` (MarketHoursFeed.isOpen) and, via `attachLiquidity`, `reallocatable` + `tripped`.
  `buildBorrowPlan` picks the vault and source markets for one `reallocateTo` (withdrawals sorted by market id).
  `publicAllocatorAbi` fragment for the browser.
- **Web**: `/earn/[key]` vault page (figures, allocation table with cap used / pending caps / watchdog status, supply
  and withdraw queues, liquidity-routing card, roles / fee / timelock with named MarketGuard, RevenueSplitter and
  PublicAllocator, sticky deposit/withdraw panel); `VaultActionPanel` extracted from `VaultCard`; Earn cards link to
  the page and show lent-vs-cap per market. Borrow table shows "+X via vaults" and a status chip (Active / Capped /
  Market closed); market page shows "In the market now" vs "Pullable from vaults", a stock-market-closed notice and a
  watchdog notice; the Borrow panel turns a borrow above free liquidity into **two steps** (pull liquidity through the
  PublicAllocator, then borrow), reading the live Morpho market so step 2 unlocks as soon as step 1 confirms.
  API: `/api/v2/vaults/:key`, `/api/borrow-plan`; server reads markets + vaults as one 10 s snapshot.
- Verified: forge 33/33, sdk + web typecheck, Anvil rehearsal + smoke, pages read on the local dev server (vault page,
  market page, Borrow and Earn lists, no console errors). Wallet writes still only via `cast`.

Next
1. Commit + push (Vercel redeploys; the testnet API then shows pullable liquidity).
2. Earn: first-deposit protection decision, V1.1 vs Vault V2 decision; Borrow: market-hours copy is in, oracle step
   (real feeds, staleness, sequencer) and the liquidator/watchdog services remain.
3. Stake page after Earn/Borrow; Fixed deferred.

