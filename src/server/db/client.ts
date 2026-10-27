import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { logger } from "@/server/logger";
import * as schema from "./schema";
import { seedDatabase } from "./seed";

export type Db = BetterSQLite3Database<typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

/**
 * Abre o banco, aplica as migrações e popula os dados de exemplo se estiver vazio.
 * Use ":memory:" nos testes.
 */
export function openDatabase(file: string, options: { seedNow?: Date } = {}): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  const seeded = seedDatabase(db, options.seedNow ?? new Date());
  if (seeded) logger.info("db.seeded", { file });
  return db;
}

// Uma conexão por processo. O globalThis evita abrir várias durante o hot reload do Next.
const globalForDb = globalThis as unknown as { nexoDb?: Db };

export function getDb(): Db {
  if (!globalForDb.nexoDb) {
    globalForDb.nexoDb = openDatabase(process.env.DATABASE_PATH ?? "./data/nexo.db");
  }
  return globalForDb.nexoDb;
}
