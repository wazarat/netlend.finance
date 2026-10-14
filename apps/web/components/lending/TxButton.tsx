"use client";
import { ExternalLink } from "lucide-react";
import type { useWriteContract } from "wagmi";
import { Button, StatusChip } from "@/components/ui";
import { txUrl } from "@/config/chain";
import { useTx, type TxStatus } from "@/lib/hooks/useTx";

export type WriteConfig = Parameters<ReturnType<typeof useWriteContract>["writeContract"]>[0];

type Props = {
  label: string;
  write: WriteConfig | null;
  disabledReason?: string;
  onConfirmed?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  block?: boolean;
};

const WORD: Record<TxStatus, string> = { idle: "", wallet: "Confirm in wallet", pending: "Pending", confirmed: "Confirmed", failed: "Failed" };

/** Write, wait for the receipt, and say what happened in words with a link to the explorer. */
export function TxButton({ label, write, disabledReason, onConfirmed, variant = "primary", size = "md", block = true }: Props) {
  const tx = useTx(onConfirmed);
  const disabled = !!disabledReason || !write;
  return (
    <div className="nl-stack">
      <Button variant={variant} size={size} block={block} loading={tx.busy} disabled={disabled} onClick={() => write && tx.write(write)}>
        {tx.status === "wallet" || tx.status === "pending" ? WORD[tx.status] : disabledReason ?? label}
      </Button>
      {tx.hash && (
        <div className="flex items-center justify-between gap-2 t-body-sm">
          <StatusChip tone={tx.status === "confirmed" ? "positive" : tx.status === "failed" ? "negative" : "neutral"} size="sm">
            {WORD[tx.status] || "Submitted"}
          </StatusChip>
          <a href={txUrl(tx.hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 nl-muted">
            View transaction <ExternalLink aria-hidden="true" width={14} height={14} strokeWidth={1.5} />
          </a>
        </div>
      )}
      {tx.error && (
        <div className="nl-notice nl-notice--negative" role="alert">
          {tx.error}
        </div>
      )}
    </div>
  );
}
