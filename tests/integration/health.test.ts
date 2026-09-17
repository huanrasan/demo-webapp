import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@/server/db";
import { handleHealth } from "@/server/health";

// Base local de docker-compose.yml con el usuario app; CI la sobrescribe con DATABASE_URL.
const reachable = createDb(
  process.env.DATABASE_URL ?? "postgresql://app:app-local@localhost:5432/booking",
);
// Puerto 1 cerrado: la conexión se rechaza de inmediato.
const unreachable = createDb("postgresql://app:app-local@127.0.0.1:1/booking");

afterAll(async () => {
  await Promise.all([reachable.$disconnect(), unreachable.$disconnect()]);
});

describe("GET /api/health", () => {
  it("responde 200 con db ok en menos de 500 ms", async () => {
    await handleHealth(reachable); // la primera conexión del pool no mide el tiempo de respuesta
    const started = performance.now();

    const response = await handleHealth(reachable);

    expect(performance.now() - started).toBeLessThan(500);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", db: "ok" });
  });

  it("responde 503 sin detalles cuando la base no responde", async () => {
    const response = await handleHealth(unreachable);

    expect(response.status).toBe(503);
    expect(await response.text()).toBe(JSON.stringify({ status: "degraded", db: "unreachable" }));
  });

  it("responde 503 si la consulta excede el tiempo límite", async () => {
    const hanging = { $queryRaw: () => new Promise(() => {}) } as unknown as typeof reachable;

    const started = performance.now();
    const response = await handleHealth(hanging, 50);

    expect(performance.now() - started).toBeLessThan(250);
    expect(response.status).toBe(503);
  });

  it("la respuesta 503 no incluye stack", async () => {
    const body = await (await handleHealth(unreachable)).text();

    expect(body).not.toMatch(/at |Error|ECONNREFUSED|127\.0\.0\.1/);
  });
});
