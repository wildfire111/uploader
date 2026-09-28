import "server-only";
import { Pool, types } from "pg";

// dates as plain strings, pg's Date parsing can shift the day
types.setTypeParser(types.builtins.DATE, (value: string) => value);

// reuse the pool across dev reloads
const globalForPool = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPool.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPool.pgPool = pool;
}
