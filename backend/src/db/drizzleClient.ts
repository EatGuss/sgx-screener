import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../models/screener/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

/**
 * Writer pool — migrations, nightly ingest, saved screens and accounts.
 * Request-time screening never uses it.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Read-only pool for request-time screening (count, results, facets, stock
 * search/detail, NL context). Point READONLY_DATABASE_URL at a role that only
 * has SELECT (see sql/create-readonly-role.sql). Every session is also opened
 * with default_transaction_read_only=on, so Postgres rejects writes on this
 * pool even when it falls back to DATABASE_URL in local development.
 */
const readPool = new Pool({
  connectionString: process.env.READONLY_DATABASE_URL || process.env.DATABASE_URL,
  options: "-c default_transaction_read_only=on",
});

export const db = drizzle(pool, { schema });
export const readDb = drizzle(readPool, { schema });

/**
 * Fail fast on a bad connection string. Scripts (seed, ingest) only write, so
 * they check the writer pool alone; the API also passes `readPool: true` so a
 * misconfigured READONLY_DATABASE_URL surfaces at boot, not on the first query.
 */
export async function initDrizzle(
  options: { readPool?: boolean } = {},
): Promise<void> {
  await pool.query("SELECT 1");
  if (options.readPool) {
    await readPool.query("SELECT 1");
  }
}

export async function closeDrizzle(): Promise<void> {
  await Promise.all([pool.end(), readPool.end()]);
}
