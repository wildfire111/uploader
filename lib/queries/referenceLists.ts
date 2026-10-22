import "server-only";
import { pool } from "../db";

export type StoredList<T> = { data: T; fetchedAt: Date };

export async function getList<T>(name: string): Promise<StoredList<T> | null> {
  const result = await pool.query<{ data: T | null; fetched_at: Date | null }>(
    `select data, fetched_at from reference_lists where name = $1`,
    [name]
  );
  const row = result.rows[0];
  // a row with no data only holds a refresh attempt
  return row?.data != null && row.fetched_at ? { data: row.data, fetchedAt: row.fetched_at } : null;
}

// just the timestamps, so deciding whether to refresh doesn't read the list itself
export async function getListTimes(
  name: string
): Promise<{ fetchedAt: Date | null; lastAttemptAt: Date | null }> {
  const result = await pool.query<{ data_present: boolean; fetched_at: Date | null; last_attempt_at: Date | null }>(
    `select data is not null as data_present, fetched_at, last_attempt_at from reference_lists where name = $1`,
    [name]
  );
  const row = result.rows[0];
  return {
    fetchedAt: row?.data_present ? row.fetched_at : null,
    lastAttemptAt: row?.last_attempt_at ?? null,
  };
}

export async function recordAttempt(name: string): Promise<void> {
  await pool.query(
    `insert into reference_lists (name, last_attempt_at)
     values ($1, now())
     on conflict (name) do update set last_attempt_at = now()`,
    [name]
  );
}

export async function saveList(name: string, data: unknown): Promise<void> {
  await pool.query(
    `insert into reference_lists (name, data, fetched_at)
     values ($1, $2, now())
     on conflict (name) do update set data = excluded.data, fetched_at = now()`,
    [name, JSON.stringify(data)]
  );
}
