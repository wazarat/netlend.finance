import type { Address } from "viem";
import type { AddressBook, BorrowPlan, MarketParamsStruct, MarketRow, VaultRow } from "../types";
import { reallocatableFrom } from "./vaults";

const min = (a: bigint, b: bigint) => (a < b ? a : b);

function params(book: AddressBook, key: string): MarketParamsStruct {
  const m = book.markets[key];
  return { loanToken: m.loanToken, collateralToken: m.collateralToken, oracle: m.oracle, irm: m.irm, lltv: m.lltv };
}

/**
 * Build the PublicAllocator.reallocateTo call that pulls `deficit` base units into `m` before a borrow.
 * Picks the vault that can move the most, takes from its most liquid other markets first, and returns the
 * withdrawals sorted by market id ascending, which the PublicAllocator requires. Null when nothing can be moved.
 */
export function buildBorrowPlan(m: MarketRow, vaults: VaultRow[], book: AddressBook, deficit: bigint): BorrowPlan | null {
  if (deficit <= 0n) return null;
  const pa = book.core?.publicAllocator as Address | undefined;
  if (!pa) return null;

  const ranked = vaults
    .map((v) => ({ v, can: reallocatableFrom(v, m.key) }))
    .filter((x) => x.can > 0n)
    .sort((a, b) => (a.can === b.can ? 0 : a.can > b.can ? -1 : 1));
  if (ranked.length === 0) return null;
  const { v, can } = ranked[0];
  const want = min(deficit, can);

  const sources = v.markets
    .filter((s) => s.key !== m.key && s.enabled)
    .map((s) => ({ key: s.key, free: [BigInt(s.raw.allocated), BigInt(s.raw.liquidity), BigInt(s.raw.maxOut)].reduce(min) }))
    .filter((s) => s.free > 0n)
    .sort((a, b) => (a.free === b.free ? 0 : a.free > b.free ? -1 : 1));

  const picks: Array<{ key: string; amount: bigint }> = [];
  let left = want;
  for (const s of sources) {
    if (left === 0n) break;
    const take = min(s.free, left);
    picks.push({ key: s.key, amount: take });
    left -= take;
  }
  const moves = want - left;
  if (moves === 0n) return null;
  picks.sort((a, b) => {
    const ia = BigInt(book.markets[a.key].id);
    const ib = BigInt(book.markets[b.key].id);
    return ia === ib ? 0 : ia < ib ? -1 : 1;
  });

  return {
    market: m.key,
    deficit: deficit.toString(),
    moves: moves.toString(),
    covers: moves >= deficit,
    vaultKey: v.key,
    vault: v.address,
    publicAllocator: pa,
    fee: v.publicAllocator.fee,
    withdrawals: picks.map((p) => ({ key: p.key, marketParams: params(book, p.key), amount: p.amount.toString() })),
    supplyMarketParams: params(book, m.key),
  };
}
