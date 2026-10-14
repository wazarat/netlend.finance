import { formatUnits } from "viem";
import { healthFactor, liquidationPrice, loanToValue, tokenDecimals, type AddressBook, type MarketRow } from "@netlend/sdk";

export type PositionTuple = readonly [bigint, bigint, bigint]; // supplyShares, borrowShares, collateral
export type MarketTuple = readonly [bigint, bigint, bigint, bigint, bigint, bigint]; // totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, lastUpdate, fee

export type Derived = {
  collateral: number;
  debt: number;
  debtRaw: bigint;
  collValue: number;
  ltv: number;
  hf: number | null;
  liq: number;
  collDec: number;
  loanDec: number;
};

/** Shares to assets and the four derived figures, identical on the market page and the portfolio. */
export function derivePosition(m: MarketRow, book: AddressBook, pos?: PositionTuple, mk?: MarketTuple): Derived {
  const collDec = tokenDecimals(book, m.collateralAddress);
  const loanDec = m.loan === "USDG" ? 6 : 18;
  const collateral = pos ? Number(formatUnits(pos[2], collDec)) : 0;
  const debtRaw = pos && mk && pos[1] > 0n && mk[3] > 0n ? (pos[1] * mk[2]) / mk[3] + 1n : 0n;
  const debt = Number(formatUnits(debtRaw, loanDec));
  const collValue = collateral * m.price;
  return {
    collateral,
    debt,
    debtRaw,
    collValue,
    ltv: loanToValue(collValue, debt),
    hf: healthFactor(collValue, m.lltv, debt),
    liq: liquidationPrice(debt, collateral, m.lltv),
    collDec,
    loanDec,
  };
}

export function parseAmount(value: string, decimals: number): bigint {
  if (!value || value === ".") return 0n;
  const [i, f = ""] = value.split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  try {
    return BigInt(i || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
  } catch {
    return 0n;
  }
}
