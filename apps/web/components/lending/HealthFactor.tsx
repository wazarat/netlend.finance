import { healthTier, healthWord } from "@netlend/sdk";
import { StatusChip } from "@/components/ui";

type Props = { value: number | null; projected?: number | null; label?: string; sub?: string; compact?: boolean };

const toneOf = { healthy: "positive", caution: "warning", "at-risk": "negative" } as const;

function pctWidth(hf: number) {
  return `${Math.round(Math.min(Math.max((hf - 1) / 2, 0.03), 1) * 100)}%`;
}

/** Health factor to two decimals with the word, and a meter from 1.00 to 3.00. Null means no debt. */
export function HealthFactor({ value, projected, label = "Health factor", sub = "Liquidation below 1.00", compact }: Props) {
  const shown = projected !== undefined ? projected : value;
  const tier = healthTier(shown);
  const word = healthWord(shown);
  const text = shown === null ? "No borrows" : shown > 99 ? ">99" : shown.toFixed(2);
  return (
    <div className={["nl-hf", tier && `nl-hf--${tier}`].filter(Boolean).join(" ")}>
      <div className="nl-hf__top">
        <span className="nl-metric__label">{label}</span>
        <StatusChip tone={tier ? toneOf[tier] : "neutral"} size="sm">
          {word}
        </StatusChip>
      </div>
      <div className={compact ? "t-figure" : "nl-metric__value"}>
        {projected !== undefined && value !== projected && value !== null ? (
          <>
            <span className="nl-muted">{value > 99 ? ">99" : value.toFixed(2)}</span> <span aria-hidden="true">→</span> <span className="sr-only">to</span> {text}
          </>
        ) : (
          text
        )}
      </div>
      <div className="nl-hf__track" role="meter" aria-valuemin={1} aria-valuemax={3} aria-valuenow={shown ?? undefined} aria-valuetext={`${text}, ${word}`} aria-label={label}>
        <div className="nl-hf__fill" style={{ width: shown === null ? "0%" : pctWidth(shown) }} />
      </div>
      {!compact && <span className="nl-metric__sub">{sub}</span>}
    </div>
  );
}
