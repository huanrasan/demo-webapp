import { spawn, type ChildProcess } from "node:child_process";
import { Writable } from "node:stream";
import { afterAll, describe, expect, it } from "vitest";
import { createLogger } from "@/server/logger";
import { HEARTBEAT_QUEUE, startWorker } from "@/worker/worker";
import { buildWorker, WORKER_OUTFILE } from "../../scripts/build-worker.mjs";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://app:app-local@localhost:5432/booking";

function capture() {
  const events: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      for (const line of chunk.toString().trim().split("\n")) events.push(JSON.parse(line).event);
      done();
    },
  });
  return { events, logger: createLogger({ level: "info", destination: stream }) };
}

async function waitFor(condition: () => boolean, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("tiempo de espera agotado");
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe("worker", () => {
  const stops: (() => Promise<void>)[] = [];
  afterAll(async () => {
    await Promise.all(stops.map((stop) => stop()));
  });

  it("programa el heartbeat cada minuto y lo procesa", async () => {
    const { events, logger } = capture();
    const worker = await startWorker({ connectionString: databaseUrl, logger });
    stops.push(worker.stop);

    const schedules = await worker.boss.getSchedules(HEARTBEAT_QUEUE);
    expect(schedules.map((s) => s.cron)).toEqual(["* * * * *"]);

    // El cron acumula trabajos mientras no corre ningún worker; sin vaciarlos el test esperaría a que drene la cola.
    await worker.boss.deleteQueuedJobs(HEARTBEAT_QUEUE);
    await worker.boss.send(HEARTBEAT_QUEUE);
    await waitFor(() => events.includes("worker_heartbeat"), 10_000);
  });

  it("termina con código 0 al recibir SIGTERM", async () => {
    await buildWorker();

    const child: ChildProcess = spawn(process.execPath, [WORKER_OUTFILE], {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "production",
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_SECRET: "x".repeat(32),
        BETTER_AUTH_URL: "http://localhost:3000",
        BUSINESS_NAME: "Demo",
        BUSINESS_TIMEZONE: "America/Bogota",
        BRAND_PRIMARY_COLOR: "#1d4ed8",
        EMAIL_TRANSPORT: "smtp",
        EMAIL_FROM: "reservas@example.com",
        SMTP_URL: "smtp://localhost:1025",
      },
    });
    let stdout = "";
    child.stdout?.on("data", (chunk) => (stdout += chunk));
    const exited = new Promise<number | null>((resolve) =>
      child.on("exit", (code) => resolve(code)),
    );

    await waitFor(() => stdout.includes('"event":"worker_started"'), 20_000);
    const started = Date.now();
    child.kill("SIGTERM");

    expect(await exited).toBe(0);
    expect(Date.now() - started).toBeLessThan(31_000);
    expect(stdout).toContain('"event":"worker_stopped"');
  }, 60_000);
});
