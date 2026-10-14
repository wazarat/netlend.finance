import { chainId, CHAIN_KEY, deployed } from "@/config/chain";
import { json } from "@/lib/data/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ ok: true, chain: CHAIN_KEY, chainId, deployed }, { headers: { "Cache-Control": "no-store" } });
}
