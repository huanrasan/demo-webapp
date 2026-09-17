import type { Logger } from "pino";
import type { Db } from "@/server/db";

const DB_TIMEOUT_MS = 300;

type Probe = { ok: true } | { ok: false; reason: "timeout" | "error"; errorName: string };

async function probeDatabase(db: Pick<Db, "$queryRaw">, timeoutMs: number): Promise<Probe> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<Probe>((resolve) => {
    timer = setTimeout(
      () => resolve({ ok: false, reason: "timeout", errorName: "Timeout" }),
      timeoutMs,
    );
  });
  const query = db.$queryRaw`SELECT 1`.then(
    () => ({ ok: true }) as Probe,
    (error: unknown) =>
      ({
        ok: false,
        reason: "error",
        errorName: error instanceof Error ? error.name : "Error",
      }) as Probe,
  );
  try {
    return await Promise.race([query, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// AC-3/AC-4: el cuerpo nunca incluye detalles del error (T-12); el motivo solo va al log.
export async function handleHealth(
  db: Pick<Db, "$queryRaw">,
  options: { timeoutMs?: number; logger?: Logger } = {},
): Promise<Response> {
  const probe = await probeDatabase(db, options.timeoutMs ?? DB_TIMEOUT_MS);
  if (!probe.ok) {
    options.logger?.warn({
      event: "health_degraded",
      check: "database",
      reason: probe.reason,
      errorName: probe.errorName,
    });
  }
  return Response.json(
    probe.ok ? { status: "ok", db: "ok" } : { status: "degraded", db: "unreachable" },
    { status: probe.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
