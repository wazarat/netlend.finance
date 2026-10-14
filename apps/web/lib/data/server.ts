import { createPublicClient, http, parseUnits, type PublicClient } from "viem";
import {
  attachLiquidity,
  buildBorrowPlan,
  computeStats,
  readMarkets,
  readVaults,
  registry,
  vaultsResponse,
  type BorrowPlan,
  type MarketRow,
  type Stats,
  type VaultRow,
  type VaultsResponse,
} from "@netlend/sdk";
import { book, chainId, chainName, deployed, rpcUrl, wagmiChain } from "@/config/chain";

/**
 * Server-side reads for the /api route handlers. One client, one 10-second snapshot (markets + vaults read together,
 * because a market's reallocatable liquidity depends on the vaults), shared across requests of a lambda.
 */

export type Snapshot = { markets: MarketRow[]; vaults: VaultRow[] };
type Cache = { snapshot?: { at: number; value: Promise<Snapshot> } };
const g = globalThis as unknown as { __netlendClient?: PublicClient; __netlendCache?: Cache };

const TTL_MS = 10_000;

export function getClient(): PublicClient {
  if (!g.__netlendClient) {
    g.__netlendClient = createPublicClient({
      chain: wagmiChain,
      transport: http(process.env.RPC_URL || rpcUrl),
      batch: { multicall: !!book.known?.multicall3 },
    });
  }
  return g.__netlendClient;
}

function cache(): Cache {
  if (!g.__netlendCache) g.__netlendCache = {};
  return g.__netlendCache;
}

export function getSnapshot(): Promise<Snapshot> {
  const c = cache();
  if (!c.snapshot || Date.now() - c.snapshot.at > TTL_MS) {
    const value = (async () => {
      const client = getClient();
      const markets = await readMarkets(client, book, registry);
      const vaults = await readVaults(client, book, registry, markets);
      return { markets: attachLiquidity(markets, vaults, book), vaults };
    })().catch((e) => {
      c.snapshot = undefined;
      throw e;
    });
    c.snapshot = { at: Date.now(), value };
  }
  return c.snapshot.value;
}

export async function getMarkets(): Promise<MarketRow[]> {
  return (await getSnapshot()).markets;
}

export async function getVaults(): Promise<VaultsResponse> {
  return vaultsResponse((await getSnapshot()).vaults);
}

export async function getVault(key: string): Promise<VaultRow | undefined> {
  return (await getSnapshot()).vaults.find((v) => v.key === key);
}

export async function getStats(): Promise<Stats> {
  return computeStats(await getMarkets(), chainName, chainId, deployed);
}

export type BorrowPlanResponse = {
  market: string;
  amount: string;
  available: string;
  reallocatable: number;
  needsReallocation: boolean;
  plan: BorrowPlan | null;
};

/** What it takes to borrow `amount` (human units) from `key`: nothing, or one PublicAllocator call first. */
export async function getBorrowPlan(key: string, amount: string): Promise<BorrowPlanResponse | undefined> {
  const { markets, vaults } = await getSnapshot();
  const m = markets.find((x) => x.key === key);
  if (!m) return undefined;
  const dec = m.loan === "USDG" ? 6 : 18;
  const want = parseUnits(amount, dec);
  const available = BigInt(m.raw.totalSupplyAssets) - BigInt(m.raw.totalBorrowAssets);
  const deficit = want > available ? want - available : 0n;
  return {
    market: key,
    amount: want.toString(),
    available: available.toString(),
    reallocatable: m.reallocatable,
    needsReallocation: deficit > 0n,
    plan: deficit > 0n ? buildBorrowPlan(m, vaults, book, deficit) : null,
  };
}

const CACHE_HEADERS = { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" };

/** JSON response with bigint safety (readers return numbers, this is belt and braces). */
export function json(data: unknown, init: ResponseInit = {}): Response {
  const body = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return new Response(body, { ...init, headers: { ...CACHE_HEADERS, ...(init.headers ?? {}) } });
}

export function jsonError(message: string, status = 502): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
