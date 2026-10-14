import { formatUnits, type Address, type PublicClient } from "viem";
import { IMetaMorpho } from "../abis";
import type { AddressBook, MarketRow, Registry, VaultRow, VaultsResponse } from "../types";
import { multiRead } from "./multiRead";

const VAULT_FIELDS = ["totalAssets", "totalSupply", "fee", "feeRecipient", "curator", "timelock"] as const;

/** Vault rows: one batched read per vault for the six MetaMorpho views, APY blended from the markets it allocates to. */
export async function readVaults(client: PublicClient, book: AddressBook, registry: Registry, markets: MarketRow[]): Promise<VaultRow[]> {
  const entries = Object.entries(book.vaults ?? {}).filter(([k]) => k !== "marketGuard") as Array<[string, Address]>;
  if (entries.length === 0) return [];

  const results = await multiRead(
    client,
    book,
    entries.flatMap(([, address]) => VAULT_FIELDS.map((functionName) => ({ address, abi: IMetaMorpho, functionName }))),
  );

  return entries.map(([key, address], vi) => {
    const def = registry.vaults.find((v) => v.key === key);
    const assetSymbol: "USDG" | "WETH" = def?.asset === "WETH" ? "WETH" : "USDG";
    const asset = (assetSymbol === "WETH" ? book.known.weth : book.substitutes.usdg) as Address;
    const dec = assetSymbol === "WETH" ? 18 : 6;
    const at = (j: number) => results[vi * VAULT_FIELDS.length + j];
    const big = (j: number) => (at(j)?.status === "success" ? (at(j).result as bigint) : 0n);
    const addr = (j: number) => (at(j)?.status === "success" ? (at(j).result as Address) : ("0x0000000000000000000000000000000000000000" as Address));

    const vmarkets = (def?.markets ?? []).map((k) => {
      const m = markets.find((x) => x.key === k);
      const cap = book.markets[k] ? Number(formatUnits(BigInt(book.markets[k].cap), dec)) : 0;
      return { key: k, marketId: book.markets[k]?.id, supplyAPR: m?.supplyAPR ?? 0, cap, lltv: m?.lltv ?? 0, symbol: k, collateralAddress: m?.collateralAddress, hidden: false };
    });
    const tvl = Number(formatUnits(big(0), dec));
    const weight = (k: string, cap: number) => {
      const m = markets.find((x) => x.key === k);
      return m ? Math.min(m.totalSupply, cap) : 0;
    };
    const allocated = vmarkets.reduce((s, vm) => s + weight(vm.key, vm.cap), 0);
    const apy = tvl > 0 ? vmarkets.reduce((s, vm) => s + weight(vm.key, vm.cap) * vm.supplyAPR, 0) / tvl : 0;

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
      totalShares: Number(formatUnits(big(1), 18)),
      apy,
      apyBasis: "blended",
      performanceFee: Number(formatUnits(big(2), 18)),
      feeRecipient: addr(3),
      curator: addr(4),
      timelockSeconds: Number(big(5)),
      marketCount: vmarkets.length,
      markets: vmarkets,
      allocated,
    };
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
