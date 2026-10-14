import { book } from "@/config/chain";
import { json } from "@/lib/data/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(book);
}
