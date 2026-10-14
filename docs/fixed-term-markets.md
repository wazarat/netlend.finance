# Fixed: fixed-rate, fixed-maturity USDG markets

What netlend.finance's **Fixed** tab is, how it mirrors Longbow's, and the canhav `fixed_rate_yield` worksheet
answers. Contract: `contracts/src/fixed/FixedTermMarket.sol` (GPL-2.0-or-later, our own code). Deploy:
`Deploy06_Fixed`. Tests: `contracts/test/unit/FixedTermMarket.t.sol` (12 cases).

## What Longbow does (observed 2026-10-14, REA evidence `ev_0ea7861e…6a50f`)

Headless capture of `https://www.longbow.cash/fixed` (accessibility tree + `/api/fixed/offers` body):

- Copy on the page: "Borrow or lend USDG at a rate agreed up front, held until a set maturity date. The rate does not
  move with utilisation. Every loan must be repaid by maturity."
- **The rate is a price.** "Lenders quote a price for USDG owed at maturity. Paying 0.99 today for 1.00 at maturity is
  a 1.01 % fixed rate for the term. It does not change after the offer is filled."
- **Maturity is a deadline.** "At maturity, debt stops growing and any position with debt can be liquidated, healthy
  or not. There is no automatic rollover. Repay before the date."
- **Lending is locked.** "A lender cannot withdraw on demand. Withdrawals draw only on USDG that borrowers have repaid
  or liquidations have returned. Until then, a withdrawal fails."
- Six markets, one collateral each (ETH 77 %, NVDA / SPY / TSLA 62.5 %, SGOV 86 %, spUSDG 91.5 %), **one shared
  maturity** (24 Oct 2026 00:00 UTC), best borrow rates 31–35 % APR at 9 days to maturity.
- Settlement is **Morpho Midnight** (`0x6120765B…9632` on 4663); markets are discovered from its market-creation
  logs; offers are read from an **offer mempool** contract (`0xcEF685D4…b4E2`): `/api/fixed/offers` returns
  `{mempool, topic, chainId, head, publications[{txHash, blockNumber, logIndex, items, itemsAbi}]}` where each
  publication is an ABI-encoded `bytes[]` of signed maker offers. The browser re-verifies each offer (canonical
  encoding, protocol validation, ratifier proof) before showing it: "14 of 401 offers in the mempool are takeable".

## What we build instead, and why

Midnight core is **BUSL-1.1** (canhav rule: integrate, never fork) and has no Robinhood testnet deployment. We keep the
product semantics and replace the engine with a small on-chain order book:

| Longbow / Midnight | netlend.finance `FixedTermMarket` |
|---|---|
| Market = loan token, collateral, oracle, LLTV, maturity; immutable; permissionless creation | Same (`createMarket`, LLTV from an enabled set, maturity ≤ 365 d) |
| Lender signs an offer off-chain, publishes to the mempool log, browser verifies ratifier proof | Lender **escrows USDG on-chain** in `postOffer(id, assets, price, expiry)`; cancel any time for the unfilled part |
| Price = USDG today per 1 USDG at maturity | Same: `price` is 1e18-scaled, `MIN_PRICE` 0.5 (caps the term rate at 100 %) |
| Debt is a zero-coupon face amount | Same: `borrow(offerId, face)` pays `face × price`, books `face` as debt and as the lender's claim |
| Liquidation when unhealthy, and after maturity regardless of health | Same; incentive factor is Morpho's `min(1.15, 1/(1 − 0.3(1 − LLTV)))` |
| Lenders withdraw only from repaid / recovered USDG | Same: `redeem` reverts with `NothingRepaidYet` until the market's `repaidAssets` covers the request; first come first served; bad debt is written off against the claims that redeem last |
| Oracle: Longbow-curated feed | Reuses the Deploy03 Morpho oracles (`IOracle.price()` 1e36) |
| Fees | None in v1, stated on the Fixed page |

Observed-vs-inferred: everything in the table's left column is from the page copy and the API body. How Midnight
prices a partial fill or handles bad debt was not observed; the right column is our design.

## canhav `fixed_rate_yield` worksheet

- **Asset / yield source** (`fixed_rate_yield.asset`): USDG (testnet `MockUSDG`, 6 dp). The yield is borrower
  interest on an isolated collateral market, not a wrapped vault share. Registry entry: `packages/sdk/markets.json`
  (the variable markets the fixed ones reuse) and `addresses.<chain>.json → fixed.markets`.
- **Wrapper** (`fixed_rate_yield.wrapper`): none. Longbow's fixed product is an order book, not a PT/YT split, so
  Pendle / Spectra templates are rejected; `openzeppelin-erc4626` is not used here.
- **Market parameters** (`fixed_rate_yield.market`), initial testnet set (Deploy06):

  | Key | Collateral | LLTV | Term | Seed offer | Implied simple APR |
  |---|---|---|---|---|---|
  | TSLA-30D | rTSLA | 62.5 % | 30 d to next 00:00 UTC | 5,000 USDG @ 0.99 | ≈ 12.3 % |
  | ETH-30D | WETH | 77 % | 30 d | 10,000 USDG @ 0.99 | ≈ 12.3 % |
  | SPY-90D | rSPY | 62.5 % | 90 d | 5,000 USDG @ 0.975 | ≈ 10.4 % |
  | SGOV-90D | rSGOV | 86 % | 90 d | 5,000 USDG @ 0.985 | ≈ 6.2 % |

  Rate band: `MIN_PRICE` 0.5 ≤ price ≤ 1.0 (0–100 % for the term). Justification: Longbow's live book shows 31–35 %
  APR near maturity on the same collaterals; our seeds sit near the variable-rate ETH/stock borrow APR so the two tabs
  compare sensibly. Fee: 0. Seed liquidity: 25,000 testnet USDG minted to the deployer.
- **Liquidity** (`fixed_rate_yield.liquidity`): the deployer seeds one offer per market; the seed leaves by
  `cancelOffer` (unfilled part) and `redeem` (filled part) after maturity. Target depth is not meaningful on testnet.
- **Custody** (`fixed_rate_yield.custody`): each borrower's collateral and each lender's claim sit in the
  `FixedTermMarket` contract under the user's own address (`position[id][user]`, `claims[id][lender]`). No pooled
  product-side custody, no share token.
- **Rollover** (`fixed_rate_yield.rollover`): no automatic rollover (matches Longbow). One week before maturity the
  UI warns borrowers; the curator creates the next maturity (`createMarket`) so lenders can re-post; after maturity
  the liquidation bot clears any remaining debt; lenders redeem from `repaidAssets`.
- **Rate transparency** (`fixed_rate_yield.rates`): the UI labels *offer price*, *fixed rate for the term*
  (`1/price − 1`), *simple APR* (`impliedApr`), *variable borrow APR* of the matching Deploy04 market, and *fee: none*.
  The fixed rate is fixed to maturity for the filled amount only; nothing is promised to early exits (there are none).
- **Environment** (`fixed_rate_yield.environment`): canhav expects a mainnet fork because no fixed-rate factory exists
  on 46630. We instead deploy our own engine on testnet (Deploy06), so the fork step is replaced by the Anvil
  rehearsal (`scripts/rehearse-anvil.sh`) plus the live 46630 deployment.
- **Invariants** (`fixed_rate_yield.invariants`), each a test in `FixedTermMarket.t.sol`:
  1. loan-token balance = Σ open offer principal + Σ `repaidAssets` (`test_loan_token_balance_…`)
  2. a fill never leaves the borrower above LLTV at face (`test_borrow_above_lltv_reverts`)
  3. no redemption without repayment (`test_lending_is_locked_…`)
  4. healthy positions are not liquidatable before maturity, every indebted one is after
  5. liquidation repays `seized × price / LIF` and caps at the debt
  6. bad debt zeroes the position and `totalDebtFace`, never `totalClaims`
  7. offers cannot be filled past their expiry or the market's maturity

## Open items
- Off-chain offer mempool with signed quotes (gasless posting) once the on-chain book works end to end.
- Protocol fee on the lender discount, if adopted, must go through the same `RevenueSplitter` as the vaults.
- Partial early repayment at a discount (Midnight behaviour unknown); today early repayment pays face.
