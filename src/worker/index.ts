import { loadConfig } from "@/server/config";
import { createLogger } from "@/server/logger";
import { startWorker } from "./worker";

const config = loadConfig();
const logger = createLogger({ level: config.LOG_LEVEL });
const worker = await startWorker({ connectionString: config.DATABASE_URL, logger });

process.once("SIGTERM", async () => {
  await worker.stop();
  process.exit(0);
});
