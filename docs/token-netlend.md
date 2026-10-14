# NETLEND token design (for the canhav token design, launch target: canhav curve on 46630)

The $BOW analogue. Linked canhav design `0eb42a9c-f793-4edb-977e-c32cb6454eff`
(https://www.canhav.com/studio/token/0eb42a9c-f793-4edb-977e-c32cb6454eff), created by the agent on 2026-10-14 with
`create_linked_token_design`; the fields below are proposed in change `d3e7df24…` (+ `017315b2…` clearing the
governance notes) and wait for the owner's acceptance. This file stays the source of truth for edits.

## Rationale
- **why:** `fee_capture`. **path:** `issue_and_lock`.
- **beyond a database row:** stakers lock NETLEND in `StakingRewards` and receive USDG streamed per second from a
  `RevenueSplitter` that is the fee recipient of every netlend vault. The claim is enforced on-chain.

## Supply and allocations (fixed, 1,000,000,000)
| Bucket | % | Notes |
|---|---|---|
| Public (canhav curve) | 30 | the curve sale; on testnet the faucet mints this share 1,000 at a time |
| Liquidity | 10 | LP locked 12 months |
| Treasury / ecosystem | 25 | multisig before mainnet |
| Team | 20 | 12-month cliff, 36-month linear |
| Investors | 5 | 6-month cliff, 24-month linear |
| Advisors | 2 | 9-month cliff, 18-month linear (staggered from investors so unlocks do not cluster) |
| Staker and borrower rewards | 8 | Rush / Season-style merkle programs |

Release `cliff_then_linear`; a founder who leaves returns unvested tokens to treasury.

## Market
- Launch target `canhav_curve`, at launch, 1 ETH seed liquidity from the team treasury (testnet ETH for 46630).
- LP locked 12 months (a stated commitment: the CanHav AMM has no dated locker, so this needs a custom locker or stays a published promise).
- Anti-sniping: the CanHav curve launcher's buy-tax window (the only mechanism it enforces; a delay or per-wallet cap would need custom market contracts).
- Distribution event: none (the curve is the sale).

## Governance / legal / post-launch
- Mechanism, admin keys and treasury custody: planned before mainnet (staked NETLEND votes on vault caps and new
  maturities; vault roles move to a 3-of-5 multisig; treasury share held by the multisig-owned splitter).
- Counsel: engaging before mainnet.
- Reporting monthly, 12 months runway.
- Milestones: 2026-11-15 testnet staking pays USDG; 2026-12-15 fixed-term markets live on testnet; 2027-02-01
  mainnet readiness review.
- Failure criteria: fewer than 100 distinct stakers or under 1,000 USDG streamed to stakers within 90 days.
- Price-collapse plan: no buybacks; staking yield is USDG and independent of token price; vesting continues; treasury
  covers 12 months of runway in USDG.

## check_design result (2026-10-14, inline doc, valid)
- Warning `unlock_cluster` before the advisor cliff was moved to 9 months: investors and advisors unlocked in the same month.
- Deployability: not deployable exactly as designed. CanHav enforces on-chain only one vesting schedule (deployer
  beneficiary) and the launch tax window; allocations, investor/advisor vesting, founder clawback and the LP lock are
  **stated** commitments; cliff-then-linear needs a direct factory call (launch form has no start date yet); the
  launch pool is two post-launch transactions (create pool, add liquidity).
- The inline doc must carry every field, including empty ones (`distribution.sale: {}`, `note: ""`,
  `description: ""`, `references: []`, `links: []`), or the checker crashes.

## Contracts (testnet stand-ins, Deploy07_Token)
- `NetlendToken` (`contracts/src/token/NetlendToken.sol`): ERC-20 + Permit, cap 1 B, 700 M minted to TREASURY,
  MINTER_ROLE on deployer + faucet for the 300 M public share. Replaced by the canhav-minted token at launch.
- `StakingRewards` (`contracts/src/staking/StakingRewards.sol`): Synthetix-style, 7-day streams of USDG.
- `RevenueSplitter` (`contracts/src/staking/RevenueSplitter.sol`): vault fee recipient; 25 % of the fee to the stream,
  75 % to treasury (Longbow's 80 / 15 / 5 of interest with the vault's 80 % never leaving the vault).
