# Testnet deployment runbook (Robinhood Chain testnet, chain id 46630)

Every script is idempotent: it reads `packages/sdk/addresses.46630.json`, skips what is already there and
writes what it deploys. Run from `contracts/` with `.env` loaded.

```bash
cd contracts && set -a && source ../.env && set +a
export FOUNDRY_PROFILE=default
COMMON="--rpc-url $RH_RPC_URL --broadcast --verify --verifier blockscout --verifier-url $RH_VERIFIER_URL -vvv"
```

| # | Script | Deploys | Needs |
|---|---|---|---|
| 1 | `forge script script/Deploy01_Core.s.sol $COMMON` | Morpho Blue, AdaptiveCurveIRM, ChainlinkOracleV2 factory, MetaMorpho factory, PublicAllocator; enables LLTVs 38.5/62.5/77/86/91.5 % | deployer ETH |
| 2 | `forge script script/Deploy02_Substitutes.s.sol $COMMON` | MockUSDG, 6 stock tokens, 24/5 feeds, 2 memes, 2 NFT collections, Faucet | — |
| 2b | `forge script script/Deploy02b_Uniswap.s.sol $COMMON` | Uniswap v3 factory/router/NPM/quoter + seeded USDG pools | ≥ 0.55 testnet ETH on deployer (wraps 0.5) |
| 3 | `forge script script/Deploy03_Oracles.s.sol $COMMON` | one Morpho oracle per market (feed pair or 30-min TWAP) | 2, 2b; TWAP needs ≥ 30 min since pool init |
| 4 | `forge script script/Deploy04_Markets.s.sol $COMMON` | 11 isolated markets, writes `markets.<KEY>` | 3 |
| 5 | `forge script script/Deploy05_Vaults.s.sol $COMMON` | MarketGuard + Core / Frontier / ETH vaults with caps, 10 % fee, guardian, 1-day timelock | 4 |

Roles default to the deployer. Override with `OWNER`, `CURATOR`, `ALLOCATOR`, `SENTINEL`, `FEE_RECIPIENT`,
`WATCHDOG_KEEPER` in `.env` before step 1 (step 5 reads them).

## Funding the deployer
1. The deployer address is `DEPLOYER_ADDRESS` in `.env` (key generated locally, never committed).
2. Request testnet ETH at https://faucet.testnet.chain.robinhood.com (QuickNode and Chainlink faucets also serve 46630).
3. Steps 1–5 need roughly 0.15 ETH of gas plus the 0.5 ETH wrapped for the WETH/USDG pool.

## Verifying later
```bash
forge verify-contract <addr> src/mocks/MockUSDG.sol:MockUSDG --chain-id 46630 \
  --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/
```

## After deployment
- `scripts/export-abis.sh` regenerates `packages/sdk/abis/*.json` if any contract interface changed.
- Commit `packages/sdk/addresses.46630.json`; Vercel rebuilds `apps/web` on push and the site switches from
  "Coming soon" to live figures (env `NEXT_PUBLIC_CHAIN=46630` is already set on the project).
- canhav: propose `stage: testnet_deployed` and `testnetContracts` (Morpho, MetaMorpho factory, the three vaults,
  MarketGuard, faucet, USDG; max 10 addresses). `verifyWallet` (the deployer) and `githubRepo` were proposed on
  2026-10-14 (change 276d7907…).
