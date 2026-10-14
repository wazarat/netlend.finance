/** Until issuer logos exist: a surface-muted circle with the first two letters of the symbol. */
export function TokenDot({ symbol, size }: { symbol: string; size?: "lg" }) {
  const letters = symbol.replace(/^[rm]/, "").slice(0, 2).toUpperCase();
  return (
    <span className={["nl-token__dot", size === "lg" && "nl-token__dot--lg"].filter(Boolean).join(" ")} aria-hidden="true">
      {letters}
    </span>
  );
}

export function Token({ symbol, label }: { symbol: string; label?: string }) {
  return (
    <span className="nl-token">
      <TokenDot symbol={symbol} />
      {label ?? symbol}
    </span>
  );
}
