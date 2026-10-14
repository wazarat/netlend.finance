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
