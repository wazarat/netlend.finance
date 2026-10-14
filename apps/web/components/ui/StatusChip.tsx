import type { ReactNode } from "react";

export type ChipTone = "positive" | "warning" | "negative" | "neutral";

/** Dot plus a word. Status is never colour alone. */
export function StatusChip({ tone = "neutral", size, children, className }: { tone?: ChipTone; size?: "sm"; children: ReactNode; className?: string }) {
  return <span className={["nl-chip", `nl-chip--${tone}`, size === "sm" && "nl-chip--sm", className].filter(Boolean).join(" ")}>{children}</span>;
}
