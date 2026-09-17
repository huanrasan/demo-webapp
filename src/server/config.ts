import { z } from "zod";
import { contrastRatio } from "@/domain/color";
import { isValidTimeZone } from "@/domain/time";

const required = z.string().min(1);

const isUrl = (value: string) => URL.canParse(value);

const schema = z
  .object({
    DATABASE_URL: required.refine((v) => /^postgres(ql)?:\/\//.test(v) && isUrl(v)),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: required.refine(isUrl),
    BUSINESS_NAME: required,
    BUSINESS_TIMEZONE: required.refine(isValidTimeZone),
    BRAND_PRIMARY_COLOR: required
      .regex(/^#[0-9a-fA-F]{6}$/)
      .refine((v) => contrastRatio(v, "#ffffff") >= 4.5),
    EMAIL_TRANSPORT: z.enum(["ses", "smtp"]),
    EMAIL_FROM: z.email(),
    SMTP_URL: required.refine(isUrl).optional(),
    AWS_REGION: required.optional(),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  })
  .superRefine((config, ctx) => {
    if (config.EMAIL_TRANSPORT === "smtp" && !config.SMTP_URL) {
      ctx.addIssue({ code: "custom", path: ["SMTP_URL"], message: "requerido" });
    }
    if (config.EMAIL_TRANSPORT === "ses" && !config.AWS_REGION) {
      ctx.addIssue({ code: "custom", path: ["AWS_REGION"], message: "requerido" });
    }
  });

export type Config = z.infer<typeof schema>;

export class ConfigError extends Error {
  constructor(readonly variables: string[]) {
    // Solo nombres de variables: los mensajes de validación podrían incluir valores secretos.
    super(`Configuración inválida o incompleta en: ${variables.join(", ")}`);
    this.name = "ConfigError";
  }
}

export function parseConfig(env: Record<string, string | undefined>): Config {
  const blanksAsMissing = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== ""),
  );
  const result = schema.safeParse(blanksAsMissing);
  if (!result.success) {
    const variables = [...new Set(result.error.issues.map((i) => String(i.path[0])))].sort();
    throw new ConfigError(variables);
  }
  return result.data;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  try {
    return parseConfig(env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error(error.message);
    process.exit(1);
  }
}
