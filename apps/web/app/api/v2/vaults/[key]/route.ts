import { getVault, json, jsonError } from "@/lib/data/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  try {
    const v = await getVault(decodeURIComponent(key));
    return v ? json(v) : jsonError("unknown vault", 404);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "read failed");
  }
}
