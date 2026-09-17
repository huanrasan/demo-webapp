import { describe, expect, it } from "vitest";
import { contrastRatio } from "./color";

describe("contraste WCAG", () => {
  it("calcula 21:1 entre negro y blanco", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("calcula el contraste de un color intermedio", () => {
    // #767676 es el gris más claro que cumple 4,5:1 sobre blanco.
    expect(contrastRatio("#767676", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });
});
