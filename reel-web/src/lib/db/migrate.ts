/**
 * Standalone migration runner — invoked by Dockerfile entrypoint.
 *
 *   tsx ./migrate.ts
 *
 * Reads DATABASE_URL from env, applies any unapplied migrations from
 * ./migrations (or ./src/lib/db/migrations in dev), then exits.
 */

import "dotenv/config";

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { existsSync } from "node:fs";
import { Pool } from "pg";

const candidatePaths = [
  process.env.MIGRATIONS_FOLDER,
  "./migrations",
  "./src/lib/db/migrations",
].filter(Boolean) as string[];

const folder = candidatePaths.find((p) => existsSync(p));
if (!folder) {
  console.error("[reel/migrate] no migrations folder found", candidatePaths);
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main(): Promise<void> {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: folder! });
  console.log("[reel/migrate] migrations applied");
  await pool.end();
}

main().catch((err) => {
  console.error("[reel/migrate] failed", err);
  process.exit(1);
});
