/** Number formatting rules from the netlend.finance brand book (Data display). Always render with tabular figures. */

const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Money above $100K in compact form ($12.4M), below that in full with two decimals. */
export function money(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e5) return `$${(n / 1e3).toFixed(1)}K`;
  return usd2.format(n);
}

/** Token amounts to the token's display precision, max six decimals. */
export function tokenAmount(n: number, maxDp = 6, minDp = 0): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: Math.min(minDp, maxDp), maximumFractionDigits: maxDp }).format(n);
}

/** Percentages to two decimals with a % sign. */
export function pct(x: number, dp = 2): string {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(dp)}%`;
}

/** Addresses are truncated to 0x12ab...89cd. */
export function shortAddress(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

/** Price of a collateral unit in the loan asset. USDG-quoted prices get 2 dp (5 for sub-dollar), WETH-quoted get 6. */
export function price(n: number, loan: "USDG" | "WETH"): string {
  if (!Number.isFinite(n)) return "—";
  if (loan === "WETH") return `${n.toFixed(6)} WETH`;
  return usd2.format(n).replace(/\.\d+$/, (d) => (n < 1 ? n.toFixed(5).slice(1) : d));
}

export function amountIn(n: number, symbol: "USDG" | "WETH"): string {
  return symbol === "USDG" ? money(n) : `${tokenAmount(n, 4)} WETH`;
}
