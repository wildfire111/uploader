import { normaliseCardName } from "./decklist/normalise";

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

// isSuccessful stays true even when a decklist line fails to import — the
// real signal is a populated, flat `errors` array (not nested under `boards`
// like the old bulk-edit response)
export type DeckImportOutcome =
  | { ok: true; deckId: string }
  | { ok: false; deckId: string | null; message: string };

export function parseDeckImportResponse(body: unknown): DeckImportOutcome {
  const response = body as { deck?: { id?: unknown }; errors?: LineError[] } | null;
  const deckId = typeof response?.deck?.id === "string" && response.deck.id ? response.deck.id : null;
  if (!deckId) {
    return { ok: false, deckId: null, message: "Moxfield did not create the deck." };
  }

  const errors = Array.isArray(response?.errors) ? response.errors : [];
  if (errors.length === 0) {
    return { ok: true, deckId };
  }

  const lines: string[] = [];
  for (const error of errors) {
    const line = describeLineError(error);
    if (line) {
      lines.push(line);
    }
  }

  if (lines.length === 0) {
    return { ok: false, deckId, message: "Moxfield did not accept the full decklist." };
  }
  const shown = lines.slice(0, MAX_LINES_SHOWN).join("; ");
  const more = lines.length > MAX_LINES_SHOWN ? ` (and ${lines.length - MAX_LINES_SHOWN} more)` : "";
  return { ok: false, deckId, message: `Moxfield could not read the decklist — ${shown}${more}` };
}

type CardSearchOutcome = { ok: true; cardId: string } | { ok: false; message: string };

// the Moxfield id of the card called `name`, from a card search reply
export function parseCardSearchResponse(body: unknown, name: string): CardSearchOutcome {
  const data = (body as { data?: unknown } | null)?.data;
  const wanted = normaliseCardName(name);
  if (Array.isArray(data)) {
    for (const card of data as { id?: unknown; name?: unknown }[]) {
      if (typeof card?.id === "string" && card.id && typeof card.name === "string" && normaliseCardName(card.name) === wanted) {
        return { ok: true, cardId: card.id };
      }
    }
  }
  return { ok: false, message: `Moxfield could not find the companion "${name}".` };
}

type CreateFolderOutcome = { ok: true; id: string } | { ok: false; message: string };

export function parseCreateFolderResponse(body: unknown): CreateFolderOutcome {
  const response = body as { id?: unknown } | null;
  if (typeof response?.id === "string" && response.id) {
    return { ok: true, id: response.id };
  }
  return { ok: false, message: "Moxfield did not create the folder." };
}

type RefreshOutcome =
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
