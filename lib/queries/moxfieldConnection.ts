import "server-only";
import type { Pool, PoolClient } from "pg";
import { pool } from "../db";

type Db = Pick<Pool | PoolClient, "query">;

export type MoxfieldConnectionRow = {
  encryptedRefreshToken: string | null;
  encryptedAccessToken: string | null;
  accessTokenExpiresAt: Date | null;
  moxfieldUsername: string | null;
  encryptedUserAgent: string | null;
  userAgentUpdatedBy: string | null;
  userAgentUpdatedAt: Date | null;
  updatedBy: string;
  updatedAt: Date;
};

type Row = {
  encrypted_refresh_token: string | null;
  encrypted_access_token: string | null;
  access_token_expires_at: Date | null;
  moxfield_username: string | null;
  encrypted_user_agent: string | null;
  user_agent_updated_by: string | null;
  user_agent_updated_at: Date | null;
  updated_by: string;
  updated_at: Date;
};

export async function getConnectionRow(db: Db = pool): Promise<MoxfieldConnectionRow | null> {
  const result = await db.query<Row>(`select * from moxfield_connection where id = 1`);
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    encryptedRefreshToken: row.encrypted_refresh_token,
    encryptedAccessToken: row.encrypted_access_token,
    accessTokenExpiresAt: row.access_token_expires_at,
    moxfieldUsername: row.moxfield_username,
    encryptedUserAgent: row.encrypted_user_agent,
    userAgentUpdatedBy: row.user_agent_updated_by,
    userAgentUpdatedAt: row.user_agent_updated_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

type Tokens = {
  encryptedRefreshToken: string;
  encryptedAccessToken: string;
  accessTokenExpiresAt: Date;
  moxfieldUsername: string | null;
};

export async function saveAdminSuppliedTokens(
  db: Db,
  tokens: Tokens,
  updatedBy: string
): Promise<void> {
  await db.query(
    `insert into moxfield_connection
       (id, encrypted_refresh_token, encrypted_access_token, access_token_expires_at, moxfield_username, updated_by, updated_at)
     values (1, $1, $2, $3, $5, $4, now())
     on conflict (id) do update set
       encrypted_refresh_token = excluded.encrypted_refresh_token,
       encrypted_access_token = excluded.encrypted_access_token,
       access_token_expires_at = excluded.access_token_expires_at,
       moxfield_username = excluded.moxfield_username,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    [
      tokens.encryptedRefreshToken,
      tokens.encryptedAccessToken,
      tokens.accessTokenExpiresAt,
      updatedBy,
      tokens.moxfieldUsername,
    ]
  );
}

// automatic refresh: leaves updated_by alone
export async function saveRotatedTokens(db: Db, tokens: Tokens): Promise<void> {
  await db.query(
    `update moxfield_connection
     set encrypted_refresh_token = $1, encrypted_access_token = $2, access_token_expires_at = $3,
         moxfield_username = coalesce($4, moxfield_username)
     where id = 1`,
    [
      tokens.encryptedRefreshToken,
      tokens.encryptedAccessToken,
      tokens.accessTokenExpiresAt,
      tokens.moxfieldUsername,
    ]
  );
}

// creates the row if needed; updated_by only matters then
export async function saveUserAgent(encryptedUserAgent: string, updatedBy: string): Promise<void> {
  await pool.query(
    `insert into moxfield_connection
       (id, updated_by, encrypted_user_agent, user_agent_updated_by, user_agent_updated_at)
     values (1, $2, $1, $2, now())
     on conflict (id) do update set
       encrypted_user_agent = excluded.encrypted_user_agent,
       user_agent_updated_by = excluded.user_agent_updated_by,
       user_agent_updated_at = now()`,
    [encryptedUserAgent, updatedBy]
  );
}
