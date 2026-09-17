// Empaqueta el proceso worker (ADR-0004) en dist/worker.mjs; las dependencias se resuelven desde node_modules.
import path from "node:path";
import { build } from "esbuild";

export const WORKER_OUTFILE = path.resolve("dist/worker.mjs");

export async function buildWorker() {
  await build({
    entryPoints: ["src/worker/index.ts"],
    outfile: WORKER_OUTFILE,
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    packages: "external",
    alias: { "@": path.resolve("src") },
    logLevel: "warning",
  });
}

if (import.meta.url === `file://${process.argv[1]}`) await buildWorker();
