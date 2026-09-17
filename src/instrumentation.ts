import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadConfig } = await import("@/server/config");
    loadConfig();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getLogger } = await import("@/server/app-logger");
  const { logServerError } = await import("@/server/logger");
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  logServerError(getLogger(), {
    requestId: headers.get("x-request-id") ?? "desconocido",
    digest:
      typeof error === "object" && error !== null && "digest" in error
        ? String(error.digest)
        : undefined,
    request: { method: request.method, url: request.path },
    error,
  });
};
