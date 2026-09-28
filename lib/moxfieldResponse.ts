
const MAX_LINES_SHOWN = 5;

// a dead refresh token is a 400 "Invalid refresh token."; other failures say nothing about it
export function isDeadRefreshTokenResponse(status: number, body: unknown): boolean {
  if (status !== 400 && status !== 401 && status !== 403) {
    return false;
  }
  return JSON.stringify(body ?? "").toLowerCase().includes("invalid refresh token");
}

type LineError = { lineNumber?: unknown; errorMessage?: unknown };

function describeLineError(error: LineError): string | null {
  if (typeof error.errorMessage !== "string") {
    return null;
  }
  return typeof error.lineNumber === "number"
    ? `Line ${error.lineNumber}: ${error.errorMessage}`
    : error.errorMessage;
}

// failures come back as a 200, so read isSuccessful
export type BulkEditOutcome = { ok: true } | { ok: false; message: string };

export function parseBulkEditResponse(body: unknown): BulkEditOutcome {
  const response = body as {
    isSuccessful?: unknown;
    errors?: { boards?: Record<string, LineError[] | undefined> };
  } | null;

  if (response?.isSuccessful === true) {
    return { ok: true };
  }

  const lines: string[] = [];
  for (const boardErrors of Object.values(response?.errors?.boards ?? {})) {
    for (const error of Array.isArray(boardErrors) ? boardErrors : []) {
      const line = describeLineError(error);
      if (line) {
        lines.push(line);
      }
    }
  }

  if (lines.length === 0) {
    return { ok: false, message: "Moxfield did not accept the decklist." };
  }
  const shown = lines.slice(0, MAX_LINES_SHOWN).join("; ");
  const more = lines.length > MAX_LINES_SHOWN ? ` (and ${lines.length - MAX_LINES_SHOWN} more)` : "";
  return { ok: false, message: `Moxfield could not read the decklist — ${shown}${more}` };
}

export type CreateDeckOutcome = { ok: true; publicId: string } | { ok: false; message: string };

export function parseCreateDeckResponse(body: unknown): CreateDeckOutcome {
  const response = body as { isSuccessful?: unknown; publicId?: unknown; errors?: unknown } | null;
  if (response?.isSuccessful !== false && typeof response?.publicId === "string" && response.publicId) {
    return { ok: true, publicId: response.publicId };
  }
  const detail = response?.errors ? ` (${JSON.stringify(response.errors).slice(0, 200)})` : "";
  return { ok: false, message: `Moxfield did not create the deck${detail}.` };
}

export type RefreshOutcome =
  | { ok: true; accessToken: string; refreshToken: string; userName: string | null }
  | { ok: false; message: string };

export function parseRefreshResponse(body: unknown, sentRefreshToken: string): RefreshOutcome {
  const refresh = (body as { refresh?: Record<string, unknown> } | null)?.refresh;
  const accessToken = refresh?.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    return { ok: false, message: "Moxfield's token refresh reply had no access token." };
  }
  const newRefreshToken = refresh?.refresh_token;
  const userName = refresh?.user_name;
  return {
    ok: true,
    accessToken,
    refreshToken:
      typeof newRefreshToken === "string" && newRefreshToken ? newRefreshToken : sentRefreshToken,
    userName: typeof userName === "string" && userName.trim() ? userName.trim() : null,
  };
}
