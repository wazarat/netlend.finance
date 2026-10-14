import { getMarkets, json, jsonError } from "@/lib/data/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  try {
    const m = (await getMarkets()).find((x) => x.key === decodeURIComponent(key));
    return m ? json(m) : jsonError("unknown market", 404);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "read failed");
  }
}
