import "server-only";
import { pool } from "../db";
import type { AllowedUser } from "../types";

type AllowedUserRow = {
  email: string;
  is_admin: boolean;
};

function mapAllowedUserRow(row: AllowedUserRow): AllowedUser {
  return { email: row.email, isAdmin: row.is_admin };
}

export async function getAllowedUser(email: string): Promise<AllowedUser | null> {
  const result = await pool.query<AllowedUserRow>(
    `select * from allowed_users where email = $1`,
    [email]
  );
  const row = result.rows[0];
  return row ? mapAllowedUserRow(row) : null;
}

export async function listAllowedUsers(): Promise<AllowedUser[]> {
  const result = await pool.query<AllowedUserRow>(`select * from allowed_users order by email asc`);
  return result.rows.map(mapAllowedUserRow);
}

// new users are never admins (is_admin defaults to false); promote with setAllowedUserAdmin
export async function addAllowedUser(email: string): Promise<AllowedUser | null> {
  const result = await pool.query<AllowedUserRow>(
    `insert into allowed_users (email)
     values ($1)
     on conflict (email) do nothing
     returning *`,
    [email]
  );
  const row = result.rows[0];
  return row ? mapAllowedUserRow(row) : null;
}

export async function removeAllowedUser(email: string): Promise<void> {
  await pool.query(`delete from allowed_users where email = $1`, [email]);
}

export async function setAllowedUserAdmin(
  email: string,
  isAdmin: boolean
): Promise<AllowedUser> {
  const result = await pool.query<AllowedUserRow>(
    `update allowed_users set is_admin = $2 where email = $1 returning *`,
    [email, isAdmin]
  );
  return mapAllowedUserRow(result.rows[0]);
}
