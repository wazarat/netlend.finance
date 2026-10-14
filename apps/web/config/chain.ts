import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { chainLabel, defaultRpcUrl, defineBookChain, getAddressBook, isDeployed, type ChainKey } from "@netlend/sdk";

/** Which address book the app reads: 46630 (Robinhood Chain testnet) or local (Anvil). Set NEXT_PUBLIC_CHAIN. */
export const CHAIN_KEY: ChainKey = process.env.NEXT_PUBLIC_CHAIN === "local" ? "local" : "46630";
export const book = getAddressBook(CHAIN_KEY);
export const chainId = book.chainId;
export const chainName = chainLabel(CHAIN_KEY);
export const deployed = isDeployed(book);
export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || defaultRpcUrl(CHAIN_KEY);
export const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || book.explorer || "https://explorer.testnet.chain.robinhood.com";
export const networkLabel = CHAIN_KEY === "local" ? "Anvil" : "Robinhood testnet";

export const wagmiChain = defineBookChain(book, rpcUrl, CHAIN_KEY);

export const wagmiConfig = createConfig({
  chains: [wagmiChain],
  connectors: [injected()],
  transports: { [wagmiChain.id]: http(rpcUrl) },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

export const txUrl = (hash: string) => `${explorerUrl}/tx/${hash}`;
export const addressUrl = (address: string) => `${explorerUrl}/address/${address}`;

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
