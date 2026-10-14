import { createPublicClient, http, type PublicClient } from "viem";
import { computeStats, readMarkets, readVaults, registry, vaultsResponse, type MarketRow, type Stats, type VaultsResponse } from "@netlend/sdk";
import { book, chainId, chainName, deployed, rpcUrl, wagmiChain } from "@/config/chain";

/** Server-side reads for the /api route handlers. One client, one 10-second cache, shared across requests of a lambda. */

type Cache = { markets?: { at: number; value: Promise<MarketRow[]> }; vaults?: { at: number; value: Promise<VaultsResponse> } };
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

export function getMarkets(): Promise<MarketRow[]> {
  const c = cache();
  if (!c.markets || Date.now() - c.markets.at > TTL_MS) {
    const value = readMarkets(getClient(), book, registry).catch((e) => {
      c.markets = undefined;
      throw e;
    });
    c.markets = { at: Date.now(), value };
  }
  return c.markets.value;
}

export function getVaults(): Promise<VaultsResponse> {
  const c = cache();
  if (!c.vaults || Date.now() - c.vaults.at > TTL_MS) {
    const value = getMarkets()
      .then((m) => readVaults(getClient(), book, registry, m))
      .then(vaultsResponse)
      .catch((e) => {
        c.vaults = undefined;
        throw e;
      });
    c.vaults = { at: Date.now(), value };
  }
  return c.vaults.value;
}

export async function getStats(): Promise<Stats> {
  return computeStats(await getMarkets(), chainName, chainId, deployed);
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
