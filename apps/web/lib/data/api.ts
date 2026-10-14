import type { AddressBook, MarketRow, Stats, VaultRow, VaultsResponse } from "@netlend/sdk";
import type { BorrowPlanResponse } from "./server";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json() as Promise<T>;
}

/** Browser-side client for the app's own route handlers. Shapes match the Longbow-style API documented in docs/longbow-ledger.md. */
export const api = {
  markets: () => get<MarketRow[]>("/api/markets"),
  market: (key: string) => get<MarketRow>(`/api/markets/${encodeURIComponent(key)}`),
  vaults: () => get<VaultsResponse>("/api/v2/vaults"),
  vault: (key: string) => get<VaultRow>(`/api/v2/vaults/${encodeURIComponent(key)}`),
  stats: () => get<Stats>("/api/stats"),
  addresses: () => get<AddressBook>("/api/addresses"),
  borrowPlan: (market: string, amount: string) => get<BorrowPlanResponse>(`/api/borrow-plan?market=${encodeURIComponent(market)}&amount=${encodeURIComponent(amount)}`),
};
