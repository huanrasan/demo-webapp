import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigError, loadConfig, parseConfig } from "./config";

const valid = {
  DATABASE_URL: "postgresql://app:dev-password@localhost:5432/booking",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  BUSINESS_NAME: "Consultorio Demo",
  BUSINESS_TIMEZONE: "America/Bogota",
  BRAND_PRIMARY_COLOR: "#1d4ed8",
  EMAIL_TRANSPORT: "smtp",
  EMAIL_FROM: "reservas@example.com",
  SMTP_URL: "smtp://localhost:1025",
};

function without(env: Record<string, string>, key: string) {
  return Object.fromEntries(Object.entries(env).filter(([k]) => k !== key));
}

function errorOf(env: Record<string, string | undefined>): ConfigError {
  try {
    parseConfig(env);
  } catch (e) {
    return e as ConfigError;
  }
  throw new Error("parseConfig no falló");
}

describe("configuración", () => {
  afterEach(() => vi.restoreAllMocks());

  it("acepta una configuración válida con valores por defecto", () => {
    const config = parseConfig(valid);
    expect(config.BUSINESS_TIMEZONE).toBe("America/Bogota");
    expect(config.LOG_LEVEL).toBe("info");
    expect(config.NODE_ENV).toBe("development");
  });

  it("falla nombrando la variable sin imprimir su valor", () => {
    const secret = "short-secret-value";
    const error = errorOf({
      ...valid,
      BETTER_AUTH_SECRET: secret,
      BUSINESS_TIMEZONE: "Mars/Olympus",
    });

    expect(error).toBeInstanceOf(ConfigError);
    expect(error.variables).toEqual(["BETTER_AUTH_SECRET", "BUSINESS_TIMEZONE"]);
    expect(error.message).not.toContain(secret);
    expect(error.message).not.toContain("Mars/Olympus");
  });

  it("falla si falta una variable obligatoria", () => {
    expect(errorOf(without(valid, "DATABASE_URL")).variables).toEqual(["DATABASE_URL"]);
  });

  it("rechaza un color de marca sin contraste 4,5:1 sobre blanco", () => {
    expect(errorOf({ ...valid, BRAND_PRIMARY_COLOR: "#a3e635" }).variables).toEqual([
      "BRAND_PRIMARY_COLOR",
    ]);
  });

  it("exige SMTP_URL con transporte smtp y AWS_REGION con transporte ses", () => {
    expect(errorOf(without(valid, "SMTP_URL")).variables).toEqual(["SMTP_URL"]);
    expect(errorOf({ ...valid, EMAIL_TRANSPORT: "ses" }).variables).toEqual(["AWS_REGION"]);
  });

  it("termina el proceso con código 1 y sin valores en stderr", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    loadConfig({ ...valid, DATABASE_URL: "mysql://root:hunter2@db/booking" });

    expect(exit).toHaveBeenCalledWith(1);
    const printed = stderr.mock.calls.flat().join(" ");
    expect(printed).toContain("DATABASE_URL");
    expect(printed).not.toContain("hunter2");
  });
});
