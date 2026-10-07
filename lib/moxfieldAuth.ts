import "server-only";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { readJwtExpiry } from "./jwt";
import { isDeadRefreshTokenResponse, parseRefreshResponse } from "./moxfieldResponse";
import {
  MoxfieldRateLimitedError,
  MoxfieldReauthRequiredError,
  MoxfieldUserAgentMissingError,
} from "./moxfieldErrors";
import { MOXFIELD_API, moxfieldFetch, readBody } from "./moxfieldHttp";
import { encryptionKey } from "./moxfieldKey";
import {
  getConnectionRow,
  saveAdminSuppliedTokens,
  saveRotatedTokens,
  type MoxfieldConnectionRow,
} from "./queries/moxfieldConnection";
import { decryptSecret, encryptSecret } from "./secretBox";

const REFRESH_MARGIN_MS = 60_000;
const FALLBACK_LIFETIME_MS = 5 * 60_000;

type NewTokens = { accessToken: string; refreshToken: string; userName: string | null };

// refresh tokens rotate on every use, so the new one has to be saved
async function requestNewTokens(refreshToken: string): Promise<NewTokens> {
  const response = await moxfieldFetch(`${MOXFIELD_API}/v1/startup/authenticated`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `refresh_token=${refreshToken};`,
    },
    body: JSON.stringify({ ignoreCookie: false, isAppLogin: false }),
  });
  const body = await readBody(response);

  if (isDeadRefreshTokenResponse(response.status, body)) {
    throw new MoxfieldReauthRequiredError();
  }
  if (!response.ok) {
    throw new Error(`Moxfield refused the token refresh (HTTP ${response.status}).`);
  }

  const parsed = parseRefreshResponse(body, refreshToken);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed;
}

function encryptTokens(tokens: NewTokens) {
  const key = encryptionKey();
  const expiresAt =
    readJwtExpiry(tokens.accessToken) ?? new Date(Date.now() + FALLBACK_LIFETIME_MS);
  return {
    encryptedRefreshToken: encryptSecret(tokens.refreshToken, key),
    encryptedAccessToken: encryptSecret(tokens.accessToken, key),
    accessTokenExpiresAt: expiresAt,
    moxfieldUsername: tokens.userName,
  };
}

function usableCachedAccessToken(
  row: MoxfieldConnectionRow,
  rejectedToken: string | undefined
): string | null {
  if (!row.encryptedAccessToken || !row.accessTokenExpiresAt) {
    return null;
  }
  if (row.accessTokenExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS) {
    return null;
  }
  try {
    const token = decryptSecret(row.encryptedAccessToken, encryptionKey());
    return token === rejectedToken ? null : token;
  } catch {
    return null;
  }
}

// lock so two requests can't spend the same refresh token
async function withTokenLock<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`select pg_advisory_xact_lock(hashtext('moxfield_token_refresh'))`);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function getValidAccessToken(rejectedToken?: string): Promise<string> {
  const cachedRow = await getConnectionRow();
  if (!cachedRow?.encryptedRefreshToken) {
    throw new MoxfieldReauthRequiredError();
  }
  const cached = usableCachedAccessToken(cachedRow, rejectedToken);
  if (cached) {
    return cached;
  }

  return withTokenLock(async (client) => {
    const row = await getConnectionRow(client);
    if (!row?.encryptedRefreshToken) {
      throw new MoxfieldReauthRequiredError();
    }
    const fresh = usableCachedAccessToken(row, rejectedToken);
    if (fresh) {
      return fresh;
    }

    let refreshToken: string;
    try {
      refreshToken = decryptSecret(row.encryptedRefreshToken, encryptionKey());
    } catch (error) {
      console.error(
        `Stored Moxfield token is unreadable: ${error instanceof Error ? error.message : error}`
      );
      throw new MoxfieldReauthRequiredError();
    }

    const tokens = await requestNewTokens(refreshToken);
    // the old refresh token is spent by now, so a failed save means reconnecting
    await saveRotatedTokens(client, encryptTokens(tokens));
    return tokens.accessToken;
  });
}

function cleanPastedToken(raw: string): string {
  return raw.trim().replace(/^["']+|["']+$/g, "").trim();
}

type SetTokenResult = { ok: true } | { ok: false; error: string };

// pasting spends the token, so store the rotated one
export async function setMoxfieldRefreshToken(
  rawToken: string,
  adminEmail: string
): Promise<SetTokenResult> {
  const token = cleanPastedToken(rawToken);
  if (!token) {
    return { ok: false, error: "Paste the refresh token first." };
  }
  if (token.length > 200 || /\s/.test(token)) {
    return {
      ok: false,
      error: "That doesn't look like a refresh token. Copy only the value of refresh_token.",
    };
  }

  try {
    await withTokenLock(async (client) => {
      const tokens = await requestNewTokens(token);
      await saveAdminSuppliedTokens(client, encryptTokens(tokens), adminEmail);
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof MoxfieldReauthRequiredError) {
      return {
        ok: false,
        error:
          "Moxfield rejected that token. It may have expired, been used already, or been copied wrongly — get a fresh one and try again. Nothing was changed.",
      };
    }
    if (error instanceof MoxfieldRateLimitedError || error instanceof MoxfieldUserAgentMissingError) {
      return { ok: false, error: error.message };
    }
    console.error(
      `Could not validate a pasted Moxfield token: ${error instanceof Error ? error.message : error}`
    );
    return {
      ok: false,
      error: `Could not check the token with Moxfield: ${error instanceof Error ? error.message : "unknown error"} Nothing was changed.`,
    };
  }
}

type MoxfieldConnectionStatus = {
  state: "connected" | "needs_reconnect" | "needs_user_agent" | "not_connected" | "unknown";
  moxfieldUsername: string | null;
  updatedBy: string | null;
  updatedAt: Date | null;
  detail: string | null;
};

export async function getMoxfieldConnectionStatus(): Promise<MoxfieldConnectionStatus> {
  const row = await getConnectionRow();
  if (!row?.encryptedRefreshToken) {
    return { state: "not_connected", moxfieldUsername: null, updatedBy: null, updatedAt: null, detail: null };
  }
  const base = { updatedBy: row.updatedBy, updatedAt: row.updatedAt };
  try {
    await getValidAccessToken();
    const fresh = await getConnectionRow();
    return {
      ...base,
      state: "connected",
      moxfieldUsername: fresh?.moxfieldUsername ?? row.moxfieldUsername,
      detail: null,
    };
  } catch (error) {
    if (error instanceof MoxfieldReauthRequiredError) {
      return { ...base, state: "needs_reconnect", moxfieldUsername: row.moxfieldUsername, detail: null };
    }
    if (error instanceof MoxfieldUserAgentMissingError) {
      return { ...base, state: "needs_user_agent", moxfieldUsername: row.moxfieldUsername, detail: null };
    }
    return {
      ...base,
      state: "unknown",
      moxfieldUsername: row.moxfieldUsername,
      detail: error instanceof Error ? error.message : "Could not check Moxfield.",
    };
  }
}

export async function getStoredMoxfieldUsername(): Promise<string | null> {
  const row = await getConnectionRow();
  return row?.encryptedRefreshToken ? row.moxfieldUsername : null;
}
