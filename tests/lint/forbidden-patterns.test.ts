import { ESLint } from "eslint";
import path from "node:path";
import { describe, expect, it } from "vitest";

const fixture = path.join(__dirname, "fixtures", "forbidden.fixture.tsx");

async function ruleIdsFor(file: string) {
  const eslint = new ESLint({ ignore: false });
  const [result] = await eslint.lintFiles([file]);
  return result.messages.map((m) => m.ruleId);
}

// threat-model T-7: XSS e inyección SQL deben bloquearse en lint, no en revisión.
describe("reglas de lint de seguridad", () => {
  it("rechaza dangerouslySetInnerHTML", async () => {
    expect(await ruleIdsFor(fixture)).toContain("react/no-danger");
  });

  it("rechaza $queryRawUnsafe y $executeRawUnsafe", async () => {
    const ids = await ruleIdsFor(fixture);
    expect(ids.filter((id) => id === "no-restricted-properties")).toHaveLength(2);
  });
});
