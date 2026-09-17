import type { Db } from "@/server/db";

const DB_TIMEOUT_MS = 300;

async function databaseResponds(db: Pick<Db, "$queryRaw">, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const query = db.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([query, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// AC-3/AC-4: el cuerpo nunca incluye detalles del error (T-12).
export async function handleHealth(
  db: Pick<Db, "$queryRaw">,
  timeoutMs = DB_TIMEOUT_MS,
): Promise<Response> {
  const ok = await databaseResponds(db, timeoutMs);
  return Response.json(
    ok ? { status: "ok", db: "ok" } : { status: "degraded", db: "unreachable" },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
