"use client";
import { Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { shortAddress } from "@netlend/sdk";
import { Button } from "@/components/ui";
import { wagmiChain } from "@/config/chain";
import { useIsMounted } from "@/lib/hooks/useIsMounted";

type Props = { size?: "md" | "sm"; variant?: "primary" | "secondary" | "ghost"; block?: boolean };

/** Injected wallet connect. Server and first client render agree (Connect wallet), the real state appears after hydration. */
export function WalletButton({ size = "sm", variant = "primary", block }: Props) {
  const mounted = useIsMounted();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const injected = connectors[0];

  if (mounted && isConnected && address) {
    if (chainId !== wagmiChain.id) {
      return (
        <Button size={size} variant="secondary" block={block} loading={switching} onClick={() => switchChain({ chainId: wagmiChain.id })}>
          Switch to {wagmiChain.name}
        </Button>
      );
    }
    return (
      <Button size={size} variant="secondary" block={block} onClick={() => disconnect()} aria-label={`Connected as ${address}. Disconnect`} className="nl-num">
        {shortAddress(address)}
      </Button>
    );
  }
  const noWallet = mounted && !injected;
  return (
    <Button
      size={size}
      variant={variant}
      block={block}
      icon={Wallet}
      loading={isPending}
      disabled={noWallet}
      onClick={() => injected && connect({ connector: injected })}
      title={error ? error.message : undefined}
    >
      {noWallet ? "No wallet found" : "Connect wallet"}
    </Button>
  );
}
