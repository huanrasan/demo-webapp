import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no carga .env; en CI y producción las variables ya vienen del entorno y no se sobrescriben.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migraciones con el usuario migrator (DDL); la app usa DATABASE_URL con el usuario app.
  datasource: { url: process.env.MIGRATION_DATABASE_URL },
});
