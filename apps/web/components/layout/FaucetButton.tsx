"use client";
import { Droplets } from "lucide-react";
import { useAccount } from "wagmi";
import { faucetAbi } from "@netlend/sdk";
import { Button } from "@/components/ui";
import { book } from "@/config/chain";
import { useIsMounted } from "@/lib/hooks/useIsMounted";
import { useTx } from "@/lib/hooks/useTx";

/** Testnet only: mints mock USDG, stock tokens and memes once per day per wallet. */
export function FaucetButton() {
  const mounted = useIsMounted();
  const { address } = useAccount();
  const tx = useTx();
  const faucet = book.substitutes?.faucet;
  if (!mounted || !address || !faucet) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={Droplets}
      loading={tx.busy}
      onClick={() => tx.write({ address: faucet, abi: faucetAbi, functionName: "claim" })}
      title={tx.error ?? "Claim test tokens (once a day)"}
    >
      {tx.status === "wallet" ? "Confirm in wallet" : tx.status === "pending" ? "Pending" : "Faucet"}
    </Button>
  );
}
