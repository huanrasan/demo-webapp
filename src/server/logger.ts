import pino, { type DestinationStream, type Logger } from "pino";

const SENSITIVE_KEYS = ["email", "phone", "token", "authorization", "cookie", "headers", "body"];

export function createLogger(options: { level: string; destination?: DestinationStream }): Logger {
  return pino(
    {
      level: options.level,
      base: undefined,
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: { level: (label) => ({ level: label }) },
      redact: {
        paths: [...SENSITIVE_KEYS, ...SENSITIVE_KEYS.map((key) => `*.${key}`)],
        censor: "[redactado]",
      },
    },
    options.destination,
  );
}

// Los mensajes de error pueden arrastrar datos del usuario (p. ej. errores de Prisma con valores).
function scrub(text: string): string {
  return text
    .replace(/[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g, "[email]")
    .replace(/\+?\d[\d\s-]{6,}\d/g, "[número]");
}

type RequestLike = { method: string; url: string; headers: Headers };

export function logServerError(
  logger: Logger,
  { requestId, request, error }: { requestId: string; request: RequestLike; error: unknown },
) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(
    {
      event: "server_error",
      requestId,
      method: request.method,
      route: new URL(request.url, "http://localhost").pathname,
      status: 500,
      errorName: err.name,
      errorMessage: scrub(err.message),
      stack: err.stack ? scrub(err.stack) : undefined,
    },
    "Error no controlado",
  );
}
