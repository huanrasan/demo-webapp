import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

describe("headers de seguridad", () => {
  it("en producción incluye HSTS y no permite eval", () => {
    const headers = securityHeaders({ nonce: "abc", production: true });

    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
    expect(headers["Content-Security-Policy"]).toContain("'nonce-abc'");
    expect(headers["Content-Security-Policy"]).not.toContain("unsafe-eval");
  });

  it("en desarrollo omite HSTS y permite eval para las herramientas de React", () => {
    const headers = securityHeaders({ nonce: "abc", production: false });

    expect(headers).not.toHaveProperty("Strict-Transport-Security");
    expect(headers["Content-Security-Policy"]).toContain("'unsafe-eval'");
  });
});
