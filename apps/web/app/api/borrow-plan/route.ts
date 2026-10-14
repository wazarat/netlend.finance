import { getBorrowPlan, json, jsonError } from "@/lib/data/server";

export const dynamic = "force-dynamic";

/** GET /api/borrow-plan?market=TSLA&amount=1000 → whether the borrow needs a PublicAllocator pull first, and the call. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const market = url.searchParams.get("market") ?? "";
  const amount = url.searchParams.get("amount") ?? "";
  if (!market || !/^\d*\.?\d*$/.test(amount) || amount === "" || amount === ".") return jsonError("market and a numeric amount are required", 400);
  try {
    const plan = await getBorrowPlan(market, amount);
    return plan ? json(plan, { headers: { "Cache-Control": "no-store" } }) : jsonError("unknown market", 404);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "read failed");
  }
}
