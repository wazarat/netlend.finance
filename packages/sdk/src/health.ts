/** Health factor maths shared by every surface, so the market page and the portfolio agree to the digit. */

export const HEALTH_BANDS = { healthy: 1.5, caution: 1.1 } as const;
export type HealthTier = "healthy" | "caution" | "at-risk";

/** Interface safe cap below LLTV so a new position never opens at the liquidation edge. */
export const SAFE_CAP = 0.9;

/** Collateral value times LLTV over debt. Null when there is no debt (the UI says "No borrows"). */
export function healthFactor(collateralValue: number, lltv: number, debt: number): number | null {
  if (!(debt > 0)) return null;
  return (collateralValue * lltv) / debt;
}

export function healthTier(hf: number | null): HealthTier | null {
  if (hf === null) return null;
  if (hf >= HEALTH_BANDS.healthy) return "healthy";
  if (hf >= HEALTH_BANDS.caution) return "caution";
  return "at-risk";
}

export function healthWord(hf: number | null): "Healthy" | "Caution" | "At risk" | "No borrows" {
  const t = healthTier(hf);
  return t === null ? "No borrows" : t === "healthy" ? "Healthy" : t === "caution" ? "Caution" : "At risk";
}

/** Collateral price at which the position becomes liquidatable. Zero when nothing is borrowed. */
export function liquidationPrice(debt: number, collateral: number, lltv: number): number {
  return collateral > 0 && debt > 0 ? debt / (collateral * lltv) : 0;
}

/** Maximum additional borrow under the safe cap. */
export function maxBorrow(collateralValue: number, lltv: number, debt: number, cap = SAFE_CAP): number {
  return Math.max(collateralValue * lltv * cap - debt, 0);
}

export function loanToValue(collateralValue: number, debt: number): number {
  return collateralValue > 0 ? debt / collateralValue : 0;
}
