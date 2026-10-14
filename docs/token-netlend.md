# NETLEND token design (for the canhav token design, launch target: canhav curve on 46630)

The $BOW analogue. The canhav MCP cannot create or link a token design (`get_linked_token_design` →
"No token design is linked"); the owner starts one on the project page in the studio, after which the agent pushes the
fields below with `update_linked_token_design`. Until then this file is the source of truth.

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
| Advisors | 2 | 6-month cliff, 18-month linear |
| Staker and borrower rewards | 8 | Rush / Season-style merkle programs |

Release `cliff_then_linear`; a founder who leaves returns unvested tokens to treasury.

## Market
- Launch target `canhav_curve`, at launch, 1 ETH seed liquidity from the team treasury (testnet ETH for 46630).
- LP locked 12 months; anti-sniping window.
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

## Contracts (testnet stand-ins, Deploy07_Token)
- `NetlendToken` (`contracts/src/token/NetlendToken.sol`): ERC-20 + Permit, cap 1 B, 700 M minted to TREASURY,
  MINTER_ROLE on deployer + faucet for the 300 M public share. Replaced by the canhav-minted token at launch.
- `StakingRewards` (`contracts/src/staking/StakingRewards.sol`): Synthetix-style, 7-day streams of USDG.
- `RevenueSplitter` (`contracts/src/staking/RevenueSplitter.sol`): vault fee recipient; 25 % of the fee to the stream,
  75 % to treasury (Longbow's 80 / 15 / 5 of interest with the vault's 80 % never leaving the vault).
