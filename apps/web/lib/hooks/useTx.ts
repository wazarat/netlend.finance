"use client";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { BaseError } from "viem";

export type TxStatus = "idle" | "wallet" | "pending" | "confirmed" | "failed";

/** One write, its receipt, and a status word the StatusChip can show. Invalidates every query once the receipt lands. */
export function useTx(onConfirmed?: () => void) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const qc = useQueryClient();
  const seen = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (receipt.isSuccess && hash && seen.current !== hash) {
      seen.current = hash;
      qc.invalidateQueries();
      onConfirmed?.();
    }
  }, [receipt.isSuccess, hash, qc, onConfirmed]);

  const status: TxStatus = isPending
    ? "wallet"
    : hash && receipt.isLoading
      ? "pending"
      : receipt.isSuccess
        ? "confirmed"
        : error || receipt.isError
          ? "failed"
          : "idle";

  const err = (error ?? receipt.error) as BaseError | null;
  const message = err ? (err.shortMessage ?? err.message) : undefined;

  return { write: writeContract, hash, status, error: message, reset, busy: isPending || (!!hash && receipt.isLoading) };
}
