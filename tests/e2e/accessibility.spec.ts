import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// AC-7 y ux.md: WCAG 2.2 AA en las pantallas base.
async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test.describe("accesibilidad", () => {
  test("inicio en español, con nombre del negocio y sin violaciones graves", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("banner")).toContainText(process.env.BUSINESS_NAME ?? "");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /Reservar un turno/ })).toBeDisabled();
    await expectNoSeriousViolations(page);
  });

  test("el primer elemento enfocable salta al contenido", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page.locator("main#contenido")).toBeFocused();
  });

  test("404 en español con enlace al inicio", async ({ page }) => {
    const response = await page.goto("/pagina-que-no-existe");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
    await expectNoSeriousViolations(page);
  });

  test("error del servidor sin detalles técnicos y con código de referencia", async ({ page }) => {
    const response = await page.goto("/e2e/error");

    // El error del servidor debe llegar como 5xx: la alarma de 5xx del ALB depende de ello.
    expect(response?.status()).toBe(500);

    await expect(page.getByRole("heading", { name: "Algo salió mal" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Intentar de nuevo" })).toBeVisible();
    await expect(page.getByText(/Código de referencia: \S+/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Error de prueba e2e");
    await expectNoSeriousViolations(page);
  });
});
