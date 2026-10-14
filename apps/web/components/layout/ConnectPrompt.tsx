import { Wallet } from "lucide-react";
import { Card } from "@/components/ui";
import { WalletButton } from "./WalletButton";

export function ConnectPrompt({ text = "Connect your wallet to see positions" }: { text?: string }) {
  return (
    <Card icon={Wallet} title={text}>
      <p className="nl-card__body mb-4">Positions, health factors and liquidation prices are read straight from the chain.</p>
      <WalletButton size="md" />
    </Card>
  );
}
