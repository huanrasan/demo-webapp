import { expect, test } from "@playwright/test";

// AC-6, threat-model T-7 y T-8. `pnpm start` corre con NODE_ENV=production.
test.describe("headers de seguridad", () => {
  test("la página de inicio envía CSP con nonce y headers de seguridad", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    const csp = headers["content-security-policy"];

    expect(response.status()).toBe(200);
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains");
    expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("una cabecera de prefetch no evita los headers de seguridad", async ({ request }) => {
    const cases: Record<string, string>[] = [
      { purpose: "prefetch" },
      { "next-router-prefetch": "1" },
    ];
    for (const headers of cases) {
      const response = await request.get("/", { headers });

      expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(response.headers()["x-content-type-options"]).toBe("nosniff");
      expect(response.headers()["strict-transport-security"]).toBeTruthy();
      expect(response.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  test("no expone el framework en los headers", async ({ request }) => {
    expect((await request.get("/")).headers()["x-powered-by"]).toBeUndefined();
  });

  test("cada petición recibe un nonce distinto", async ({ request }) => {
    const nonceOf = async () =>
      (await request.get("/")).headers()["content-security-policy"].match(/'nonce-([^']+)'/)?.[1];

    expect(await nonceOf()).not.toBe(await nonceOf());
  });

  test("los scripts de la página cargan sin violaciones de CSP", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) violations.push(message.text());
    });

    const response = await page.goto("/");
    const nonce = response?.headers()["content-security-policy"].match(/'nonce-([^']+)'/)?.[1];
    const scriptNonces = await page
      .locator("script[src]")
      .evaluateAll((scripts) => scripts.map((s) => (s as HTMLScriptElement).nonce));

    expect(scriptNonces.length).toBeGreaterThan(0);
    expect(scriptNonces.every((n) => n === nonce)).toBe(true);
    await page.waitForLoadState("networkidle");
    expect(violations).toEqual([]);
  });
});
