import { getStats, json, jsonError } from "@/lib/data/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await getStats());
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "read failed");
  }
}
