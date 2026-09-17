import { describe, expect, it } from "vitest";
import { formatInBusinessZone, isValidTimeZone, businessLocalToUtc } from "./time";

// ICU usa espacios especiales (U+202F, U+00A0) en "p. m."; se normalizan para comparar texto visible.
const plain = (s: string) => s.replace(/\s/g, " ");

describe("zona horaria del negocio", () => {
  it("guarda UTC y formatea en America/Bogota", () => {
    const instant = businessLocalToUtc(
      { year: 2026, month: 11, day: 3, hour: 15, minute: 30 },
      "America/Bogota",
    );

    expect(instant.toISOString()).toBe("2026-11-03T20:30:00.000Z");
    expect(plain(formatInBusinessZone(instant, "America/Bogota"))).toBe(
      "martes, 3 de noviembre de 2026, 3:30 p. m.",
    );
  });

  it("cruza cambio de horario en America/Santiago", () => {
    const summer = businessLocalToUtc(
      { year: 2026, month: 1, day: 15, hour: 10, minute: 0 },
      "America/Santiago",
    );
    const winter = businessLocalToUtc(
      { year: 2026, month: 7, day: 15, hour: 10, minute: 0 },
      "America/Santiago",
    );

    expect(summer.toISOString()).toBe("2026-01-15T13:00:00.000Z");
    expect(winter.toISOString()).toBe("2026-07-15T14:00:00.000Z");
    expect(plain(formatInBusinessZone(winter, "America/Santiago"))).toContain("10:00 a. m.");
  });

  it("PRUEBA DE CI: este test debe fallar y bloquear el PR", () => {
    expect(formatInBusinessZone(new Date("2026-11-03T20:30:00Z"), "America/Bogota")).toBe("valor incorrecto a propósito");
  });

  it("valida identificadores IANA", () => {
    expect(isValidTimeZone("America/Bogota")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
