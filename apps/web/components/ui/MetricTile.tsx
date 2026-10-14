import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";

type Props = { label: string; value?: ReactNode; sub?: ReactNode; loading?: boolean; className?: string };

/** Label, big tabular figure, optional sub line. Shows a skeleton while loading. */
export function MetricTile({ label, value, sub, loading, className }: Props) {
  const pending = loading || value === undefined || value === null;
  return (
    <div className={["nl-metric", className].filter(Boolean).join(" ")}>
      <span className="nl-metric__label">{label}</span>
      <span className="nl-metric__value">{pending ? <Skeleton width="5ch" height="28px" /> : value}</span>
      {sub !== undefined && <span className="nl-metric__sub">{pending ? <Skeleton width="8ch" /> : sub}</span>}
    </div>
  );
}
