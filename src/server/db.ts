import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { loadConfig } from "@/server/config";

export type Db = PrismaClient;

export function createDb(connectionString: string): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

let db: Db | undefined;

export function getDb(): Db {
  db ??= createDb(loadConfig().DATABASE_URL);
  return db;
}
