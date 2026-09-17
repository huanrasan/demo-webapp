import type { Logger } from "pino";
import { loadConfig } from "@/server/config";
import { createLogger } from "@/server/logger";

let logger: Logger | undefined;

export function getLogger(): Logger {
  logger ??= createLogger({ level: loadConfig().LOG_LEVEL });
  return logger;
}
