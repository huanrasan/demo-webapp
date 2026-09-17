import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no carga .env; en CI y producción las variables ya vienen del entorno y no se sobrescriben.
if (existsSync(".env")) process.loadEnvFile(".env");

const url = process.env.MIGRATION_DATABASE_URL;
const command = process.argv.slice(2);
if (!url && command.some((arg) => arg === "migrate" || arg === "db")) {
  console.error("Configuración inválida o incompleta en: MIGRATION_DATABASE_URL");
  process.exit(1);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migraciones con el usuario migrator (DDL); la app usa DATABASE_URL con el usuario app.
  datasource: { url },
});
