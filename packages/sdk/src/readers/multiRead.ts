import type { Address, PublicClient } from "viem";
import type { AddressBook } from "../types";

export type ContractCall = { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] };
export type CallResult = { status: "success"; result: unknown } | { status: "failure"; error: unknown; result?: undefined };

/** multicall3 when the chain has it (Robinhood testnet does), otherwise parallel single reads (Anvil). */
export async function multiRead(client: PublicClient, book: AddressBook, contracts: ContractCall[]): Promise<CallResult[]> {
  if (contracts.length === 0) return [];
  if (book.known?.multicall3) {
    return (await client.multicall({ contracts: contracts as never, allowFailure: true })) as CallResult[];
  }
  return Promise.all(
    contracts.map((c) =>
      client
        .readContract(c as never)
        .then((result) => ({ status: "success" as const, result }))
        .catch((error: unknown) => ({ status: "failure" as const, error })),
    ),
  );
}
