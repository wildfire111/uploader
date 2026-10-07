import "server-only";
import { pool } from "../db";

export type StoredList<T> = { data: T; fetchedAt: Date };

export async function getList<T>(name: string): Promise<StoredList<T> | null> {
  const result = await pool.query<{ data: T; fetched_at: Date }>(
    `select data, fetched_at from reference_lists where name = $1`,
    [name]
  );
  const row = result.rows[0];
  return row ? { data: row.data, fetchedAt: row.fetched_at } : null;
}

export async function saveList(name: string, data: unknown): Promise<void> {
  await pool.query(
    `insert into reference_lists (name, data, fetched_at)
     values ($1, $2, now())
     on conflict (name) do update set data = excluded.data, fetched_at = now()`,
    [name, JSON.stringify(data)]
  );
}
