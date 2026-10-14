import { defineChain, type Chain } from "viem";
import book46630 from "../addresses.46630.json" with { type: "json" };
import bookLocal from "../addresses.local.json" with { type: "json" };
import registryJson from "../markets.json" with { type: "json" };
import type { AddressBook, Registry } from "./types";

/** "46630" = Robinhood Chain testnet, "local" = the Anvil rehearsal written by scripts/rehearse-anvil.sh. */
export type ChainKey = "46630" | "local";

export function getAddressBook(chain: ChainKey): AddressBook {
  return (chain === "local" ? bookLocal : book46630) as unknown as AddressBook;
}

export const registry = registryJson as unknown as Registry;

export function chainLabel(chain: ChainKey): string {
  return chain === "local" ? "Anvil" : "Robinhood Chain Testnet";
}

/** True once Deploy01_Core has written the Morpho address; everything else in the UI keys off this. */
export function isDeployed(book: AddressBook): boolean {
  const m = book.core?.morpho;
  return typeof m === "string" && m.length === 42;
}

const DEFAULT_RPC: Record<ChainKey, string> = {
  "46630": "https://rpc.testnet.chain.robinhood.com",
  local: "http://127.0.0.1:8545",
};

export function defaultRpcUrl(chain: ChainKey): string {
  return DEFAULT_RPC[chain];
}

/** viem chain built from the address book, so multicall3 is only enabled where the chain has it. */
export function defineBookChain(book: AddressBook, rpcUrl: string, chain: ChainKey): Chain {
  return defineChain({
    id: book.chainId,
    name: chainLabel(chain),
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers:
      chain === "local"
        ? undefined
        : { default: { name: "Blockscout", url: book.explorer ?? "https://explorer.testnet.chain.robinhood.com" } },
    contracts: book.known?.multicall3 ? { multicall3: { address: book.known.multicall3 } } : undefined,
    testnet: true,
  });
}
