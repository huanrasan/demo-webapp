import { PgBoss } from "pg-boss";
import type { Logger } from "pino";

export const HEARTBEAT_QUEUE = "system.heartbeat";
const SHUTDOWN_TIMEOUT_MS = 30_000;

// ADR-0004: cola en el esquema pgboss de la misma PostgreSQL. El heartbeat alimenta la alarma queue.heartbeat.age.
export async function startWorker({
  connectionString,
  logger,
}: {
  connectionString: string;
  logger: Logger;
}) {
  // El esquema lo crea el bootstrap de roles con dueño app; app no tiene permiso para crear esquemas (ADR-0003).
  const boss = new PgBoss({ connectionString, schema: "pgboss", createSchema: false });
  boss.on("error", (error) => logger.error({ event: "queue_error", errorName: error.name }));

  await boss.start();
  await boss.createQueue(HEARTBEAT_QUEUE);
  await boss.schedule(HEARTBEAT_QUEUE, "* * * * *");
  await boss.work(HEARTBEAT_QUEUE, async () => {
    logger.info({ event: "worker_heartbeat" });
  });
  logger.info({ event: "worker_started" });

  return {
    boss,
    stop: async () => {
      logger.info({ event: "worker_stopping" });
      await boss.stop({ graceful: true, timeout: SHUTDOWN_TIMEOUT_MS });
      logger.info({ event: "worker_stopped" });
    },
  };
}
