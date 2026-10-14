import { formatUnits, type Address, type PublicClient } from "viem";
import { IMetaMorpho, IMorpho, IPublicAllocator, MarketGuard } from "../abis";
import type { AddressBook, Hex32, MarketRow, Registry, VaultMarketRow, VaultRow, VaultsResponse } from "../types";
import { multiRead, type CallResult, type ContractCall } from "./multiRead";

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

/** Vault views read for every vault, in this order. */
const VAULT_FIELDS = [
  "totalAssets",
  "totalSupply",
  "fee",
  "feeRecipient",
  "curator",
  "timelock",
  "owner",
  "guardian",
  "skimRecipient",
  "pendingTimelock",
  "pendingGuardian",
  "lostAssets",
  "supplyQueueLength",
  "withdrawQueueLength",
] as const;

const ok = (r: CallResult | undefined): r is { status: "success"; result: unknown } => !!r && r.status === "success";
const big = (r: CallResult | undefined): bigint => (ok(r) && typeof r.result === "bigint" ? r.result : 0n);
const addr = (r: CallResult | undefined): Address => (ok(r) && typeof r.result === "string" ? (r.result as Address) : ZERO);
const bool = (r: CallResult | undefined): boolean => ok(r) && r.result === true;
/** Struct results come back as objects (JSON ABI) or arrays (human-readable ABI); read by name with an index fallback. */
function field<T>(r: CallResult | undefined, name: string, index: number, fallback: T): T {
  if (!ok(r) || r.result == null) return fallback;
  const v = r.result as Record<string, unknown> | unknown[];
  if (Array.isArray(v)) return (v[index] as T) ?? fallback;
  return (v[name] as T) ?? fallback;
}

const min = (...xs: bigint[]) => xs.reduce((a, b) => (a < b ? a : b));

/**
 * Vault rows: MetaMorpho views, the vault's real position in each of its markets (Morpho shares → assets), vault
 * caps and pending caps, the MarketGuard trip flag and the PublicAllocator flow caps per market, and both queues.
 * Two multicall passes (queue items need the lengths first).
 */
export async function readVaults(client: PublicClient, book: AddressBook, registry: Registry, markets: MarketRow[]): Promise<VaultRow[]> {
  const entries = Object.entries(book.vaults ?? {}).filter(([k]) => k !== "marketGuard") as Array<[string, Address]>;
  if (entries.length === 0) return [];
  const morpho = book.core?.morpho as Address | undefined;
  const pa = book.core?.publicAllocator as Address | undefined;
  const guard = book.vaults?.marketGuard as Address | undefined;
  const idToKey = new Map<string, string>(Object.entries(book.markets ?? {}).map(([k, m]) => [m.id.toLowerCase(), k]));

  const calls: ContractCall[] = [];
  const plan = entries.map(([key, address]) => {
    const def = registry.vaults.find((v) => v.key === key);
    const mkeys = (def?.markets ?? []).filter((k) => book.markets[k]);
    const start = calls.length;
    for (const functionName of VAULT_FIELDS) calls.push({ address, abi: IMetaMorpho, functionName });
    if (pa) {
      calls.push({ address, abi: IMetaMorpho, functionName: "isAllocator", args: [pa] });
      calls.push({ address: pa, abi: IPublicAllocator, functionName: "fee", args: [address] });
      calls.push({ address: pa, abi: IPublicAllocator, functionName: "admin", args: [address] });
    }
    const mstart = calls.length;
    for (const k of mkeys) {
      const id = book.markets[k].id;
      if (morpho) calls.push({ address: morpho, abi: IMorpho, functionName: "position", args: [id, address] });
      calls.push({ address, abi: IMetaMorpho, functionName: "config", args: [id] });
      calls.push({ address, abi: IMetaMorpho, functionName: "pendingCap", args: [id] });
      if (guard) calls.push({ address: guard, abi: MarketGuard, functionName: "tripped", args: [address, id] });
      if (pa) calls.push({ address: pa, abi: IPublicAllocator, functionName: "flowCaps", args: [address, id] });
    }
    const perMarket = (morpho ? 1 : 0) + 2 + (guard ? 1 : 0) + (pa ? 1 : 0);
    return { key, address, def, mkeys, start, mstart, perMarket };
  });
  const res = await multiRead(client, book, calls);

  // Pass two: queue items.
  const qcalls: ContractCall[] = [];
  const qplan = plan.map((p) => {
    const sq = Number(big(res[p.start + 12]));
    const wq = Number(big(res[p.start + 13]));
    const sqStart = qcalls.length;
    for (let i = 0; i < sq; i++) qcalls.push({ address: p.address, abi: IMetaMorpho, functionName: "supplyQueue", args: [BigInt(i)] });
    const wqStart = qcalls.length;
    for (let i = 0; i < wq; i++) qcalls.push({ address: p.address, abi: IMetaMorpho, functionName: "withdrawQueue", args: [BigInt(i)] });
    return { sq, wq, sqStart, wqStart };
  });
  const qres = qcalls.length ? await multiRead(client, book, qcalls) : [];

  return plan.map((p, vi) => {
    const { key, address, def, mkeys } = p;
    const assetSymbol: "USDG" | "WETH" = def?.asset === "WETH" ? "WETH" : "USDG";
    const asset = (assetSymbol === "WETH" ? book.known.weth : book.substitutes.usdg) as Address;
    const dec = assetSymbol === "WETH" ? 18 : 6;
    const human = (x: bigint) => Number(formatUnits(x, dec));
    const at = (j: number) => res[p.start + j];

    const paOn = pa ? bool(res[p.start + VAULT_FIELDS.length]) : false;
    const paFee = pa ? big(res[p.start + VAULT_FIELDS.length + 1]) : 0n;
    const paAdmin = pa ? addr(res[p.start + VAULT_FIELDS.length + 2]) : undefined;

    const vmarkets: VaultMarketRow[] = mkeys.map((k, mi) => {
      const base = p.mstart + mi * p.perMarket;
      let o = 0;
      const posR = morpho ? res[base + o++] : undefined;
      const cfgR = res[base + o++];
      const pendR = res[base + o++];
      const tripR = guard ? res[base + o++] : undefined;
      const flowR = pa ? res[base + o++] : undefined;

      const m = markets.find((x) => x.key === k);
      const shares = field<bigint>(posR, "supplyShares", 0, 0n);
      const tsa = BigInt(m?.raw.totalSupplyAssets ?? "0");
      const tss = BigInt(m?.raw.totalSupplyShares ?? "0");
      const allocatedRaw = tss > 0n ? (shares * tsa) / tss : 0n;
      const liquidityRaw = tsa - BigInt(m?.raw.totalBorrowAssets ?? "0");
      const capRaw = field<bigint>(cfgR, "cap", 0, 0n);
      const enabled = field<boolean>(cfgR, "enabled", 1, false);
      const removableAt = Number(field<bigint>(cfgR, "removableAt", 2, 0n));
      const pendCap = field<bigint>(pendR, "value", 0, 0n);
      const pendAt = Number(field<bigint>(pendR, "validAt", 1, 0n));
      const maxIn = field<bigint>(flowR, "maxIn", 0, 0n);
      const maxOut = field<bigint>(flowR, "maxOut", 1, 0n);
      return {
        key: k,
        marketId: book.markets[k]?.id,
        supplyAPR: m?.supplyAPR ?? 0,
        cap: human(capRaw),
        lltv: m?.lltv ?? 0,
        symbol: k,
        collateralAddress: m?.collateralAddress,
        hidden: false,
        allocated: human(allocatedRaw),
        marketLiquidity: human(liquidityRaw > 0n ? liquidityRaw : 0n),
        enabled,
        removableAt,
        pendingCap: pendAt > 0 ? { cap: human(pendCap), validAt: pendAt } : undefined,
        tripped: bool(tripR),
        flowCaps: { maxIn: human(maxIn), maxOut: human(maxOut) },
        raw: { allocated: allocatedRaw.toString(), liquidity: (liquidityRaw > 0n ? liquidityRaw : 0n).toString(), cap: capRaw.toString(), maxIn: maxIn.toString(), maxOut: maxOut.toString() },
      };
    });

    const tvl = human(big(at(0)));
    const allocated = vmarkets.reduce((s, vm) => s + vm.allocated, 0);
    const apy = tvl > 0 ? vmarkets.reduce((s, vm) => s + vm.allocated * vm.supplyAPR, 0) / tvl : 0;
    const q = qplan[vi];
    const queueKeys = (start: number, n: number) =>
      Array.from({ length: n }, (_, i) => {
        const id = ok(qres[start + i]) ? String(qres[start + i].result).toLowerCase() : "";
        return idToKey.get(id) ?? id;
      });
    const pendTl = Number(field<bigint>(at(9), "value", 0, 0n));
    const pendTlAt = Number(field<bigint>(at(9), "validAt", 1, 0n));
    const pendG = field<Address>(at(10), "value", 0, ZERO);
    const pendGAt = Number(field<bigint>(at(10), "validAt", 1, 0n));

    return {
      key,
      slug: `netlend-${key}`,
      name: def?.name ?? key,
      symbol: def?.symbol ?? key,
      address,
      asset,
      assetSymbol,
      decimals: dec,
      tier: def?.tier,
      risk: def?.risk,
      status: "live",
      closed: false,
      tvl,
      totalDeposits: tvl,
      totalShares: Number(formatUnits(big(at(1)), 18)),
      apy,
      apyBasis: "blended",
      performanceFee: Number(formatUnits(big(at(2)), 18)),
      feeRecipient: addr(at(3)),
      curator: addr(at(4)),
      timelockSeconds: Number(big(at(5))),
      owner: addr(at(6)),
      guardian: addr(at(7)),
      skimRecipient: addr(at(8)),
      pendingTimelock: pendTlAt > 0 ? { seconds: pendTl, validAt: pendTlAt } : undefined,
      pendingGuardian: pendGAt > 0 ? { address: pendG, validAt: pendGAt } : undefined,
      lostAssets: human(big(at(11))),
      marketCount: vmarkets.length,
      markets: vmarkets,
      allocated,
      idle: Math.max(tvl - allocated, 0),
      supplyQueue: queueKeys(q.sqStart, q.sq),
      withdrawQueue: queueKeys(q.wqStart, q.wq),
      publicAllocator: { address: pa, isAllocator: paOn, admin: paAdmin, fee: paFee.toString() },
    };
  });
}

/** Base units a borrower could pull into `marketKey` from one vault through the PublicAllocator, within every cap. */
export function reallocatableFrom(v: VaultRow, marketKey: string): bigint {
  const target = v.markets.find((x) => x.key === marketKey);
  if (!target || !target.enabled || target.tripped || !v.publicAllocator.isAllocator) return 0n;
  const capRaw = BigInt(target.raw.cap);
  const allocatedRaw = BigInt(target.raw.allocated);
  const room = min(capRaw > allocatedRaw ? capRaw - allocatedRaw : 0n, BigInt(target.raw.maxIn));
  if (room === 0n) return 0n;
  const sources = v.markets
    .filter((s) => s.key !== marketKey && s.enabled)
    .reduce((acc, s) => acc + min(BigInt(s.raw.allocated), BigInt(s.raw.liquidity), BigInt(s.raw.maxOut)), 0n);
  return min(sources, room);
}

/** Markets with `reallocatable` (summed over vaults) and `tripped` / `enabled` set from the vaults' MarketGuard flags. */
export function attachLiquidity(markets: MarketRow[], vaults: VaultRow[], book: AddressBook): MarketRow[] {
  return markets.map((m) => {
    const dec = m.loan === "USDG" ? 6 : 18;
    const total = vaults.reduce((acc, v) => acc + reallocatableFrom(v, m.key), 0n);
    const tripped = vaults.some((v) => v.markets.some((x) => x.key === m.key && x.tripped));
    void book;
    return { ...m, reallocatable: Number(formatUnits(total, dec)), tripped, enabled: !tripped };
  });
}

export function vaultsResponse(vaults: VaultRow[]): VaultsResponse {
  return {
    asOf: Math.floor(Date.now() / 1000),
    vaults,
    totals: {
      tvlUsdg: vaults.filter((v) => v.assetSymbol === "USDG").reduce((s, v) => s + v.tvl, 0),
      tvlWeth: vaults.filter((v) => v.assetSymbol === "WETH").reduce((s, v) => s + v.tvl, 0),
    },
  };
}

export type { Hex32 };
