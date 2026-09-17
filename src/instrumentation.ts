export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadConfig } = await import("@/server/config");
    loadConfig();
  }
}
