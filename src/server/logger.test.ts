import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger, logServerError } from "./logger";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(...chunk.toString().trim().split("\n"));
      done();
    },
  });
  return { lines, logger: createLogger({ level: "info", destination: stream }) };
}

describe("logger", () => {
  it("error 500 con email en query y cookie no filtra datos", () => {
    const { lines, logger } = capture();

    logServerError(logger, {
      requestId: "req-123",
      request: {
        method: "POST",
        url: "https://reservas.example.com/api/reservas?email=ana@example.com&tel=3001234567",
        headers: new Headers({ cookie: "session=abc123", authorization: "Bearer xyz789" }),
      },
      error: new Error("No se pudo reservar para ana@example.com"),
    });

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({
      level: "error",
      requestId: "req-123",
      method: "POST",
      route: "/api/reservas",
      status: 500,
      event: "server_error",
    });
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    for (const leaked of ["ana@example.com", "3001234567", "abc123", "xyz789", "Bearer"]) {
      expect(lines[0]).not.toContain(leaked);
    }
  });

  it("redacta campos sensibles registrados directamente", () => {
    const { lines, logger } = capture();

    logger.info(
      {
        email: "ana@example.com",
        phone: "3001234567",
        token: "tok-1",
        authorization: "Bearer xyz789",
        cookie: "session=abc123",
        user: { email: "luis@example.com" },
      },
      "evento",
    );

    for (const leaked of [
      "ana@example.com",
      "3001234567",
      "tok-1",
      "xyz789",
      "abc123",
      "luis@example.com",
    ]) {
      expect(lines[0]).not.toContain(leaked);
    }
  });
});
