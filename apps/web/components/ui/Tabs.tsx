"use client";
import { useRef } from "react";

export type TabItem<T extends string = string> = { id: T; label: string };

type Props<T extends string> = { items: TabItem<T>[]; value: T; onChange: (id: T) => void; ariaLabel: string; block?: boolean; className?: string };

/** Segmented pill tabs with roving tabindex and arrow-key movement. */
export function Tabs<T extends string>({ items, value, onChange, ariaLabel, block, className }: Props<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (from: number, delta: number) => {
    const next = (from + delta + items.length) % items.length;
    onChange(items[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={ariaLabel} className={["nl-tabs", block && "nl-tabs--block", className].filter(Boolean).join(" ")}>
      {items.map((it, i) => {
        const selected = it.id === value;
        return (
          <button
            key={it.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="nl-tab"
            onClick={() => onChange(it.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i, -1);
              } else if (e.key === "Home") {
                e.preventDefault();
                move(i, -i);
              } else if (e.key === "End") {
                e.preventDefault();
                move(i, items.length - 1 - i);
              }
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
