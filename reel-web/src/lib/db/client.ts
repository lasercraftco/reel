import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __reelPool?: Pool };

const pool =
  globalForDb.__reelPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://reel:reel@localhost:5432/reel",
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__reelPool = pool;
}

export const db = drizzle(pool, { schema });

export type Db = typeof db;
