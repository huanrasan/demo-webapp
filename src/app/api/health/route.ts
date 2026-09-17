import { getDb } from "@/server/db";
import { handleHealth } from "@/server/health";

export const dynamic = "force-dynamic";

export function GET() {
  return handleHealth(getDb());
}
