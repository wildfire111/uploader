import "server-only";
import { getValidAccessToken } from "./moxfieldAuth";
import { MoxfieldContentError, MoxfieldReauthRequiredError } from "./moxfieldErrors";
import { MOXFIELD_API, moxfieldFetch, readBody } from "./moxfieldHttp";
import {
  type DeckImportOutcome,
  parseCardSearchResponse,
  parseCreateFolderResponse,
  parseDeckImportResponse,
} from "./moxfieldResponse";

type PublishDeckInput = {
  title: string;
  description: string;
  decklist: string;
  // the card to set as the deck's companion once it exists
  companion: string | null;
  folderId: string;
  pendingDeckId: string | null;
  onDeckCreated: (deckId: string) => Promise<void>;
};

async function authedRequest(method: string, path: string, body: unknown): Promise<Response> {
  let token = await getValidAccessToken();
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await moxfieldFetch(`${MOXFIELD_API}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (response.status !== 401) {
      return response;
    }
    if (attempt === 0) {
      token = await getValidAccessToken(token);
    }
  }
  throw new MoxfieldReauthRequiredError();
}

function describe(body: unknown): string {
  return (typeof body === "string" ? body : JSON.stringify(body)).slice(0, 300);
}

async function createDeckWithImport(
  title: string,
  description: string,
  decklist: string,
  folderId: string
): Promise<DeckImportOutcome> {
  const response = await authedRequest("POST", "/v3/decks", {
    name: title,
    format: "highlanderAustralian",
    visibility: "public",
    description,
    importText: decklist,
    deckFolderId: folderId,
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(`Moxfield would not create the deck (HTTP ${response.status}): ${describe(body)}`);
  }
  return parseDeckImportResponse(body);
}

async function findCardId(name: string): Promise<string> {
  const response = await authedRequest("GET", `/v2/cards/search/user?q=${encodeURIComponent(name)}&page=1`, undefined);
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(`Moxfield would not search for the companion (HTTP ${response.status}): ${describe(body)}`);
  }
  const parsed = parseCardSearchResponse(body, name);
  if (!parsed.ok) {
    throw new MoxfieldContentError(parsed.message);
  }
  return parsed.cardId;
}

// the companion sits on its own board, so the card isn't in the decklist text
async function setCompanion(deckId: string, name: string): Promise<void> {
  const cardId = await findCardId(name);
  const response = await authedRequest("PUT", `/v2/decks/${encodeURIComponent(deckId)}/cards/companions`, { cardId });
  if (!response.ok) {
    throw new Error(
      `Moxfield would not set the companion (HTTP ${response.status}): ${describe(await readBody(response))}`
    );
  }
}

async function deleteDeck(shortId: string): Promise<void> {
  try {
    await authedRequest("DELETE", `/v1/decks/${encodeURIComponent(shortId)}`, undefined);
  } catch (error) {
    // best-effort cleanup only — never let this block a retry. A failure here
    // just leaves one orphaned deck for manual cleanup on moxfield.com.
    console.error(`Could not delete the failed deck ${shortId} before retrying:`, error);
  }
}

export async function publishDeck(input: PublishDeckInput): Promise<string> {
  if (input.pendingDeckId) {
    await deleteDeck(input.pendingDeckId);
  }

  const outcome = await createDeckWithImport(input.title, input.description, input.decklist, input.folderId);
  if (outcome.ok) {
    if (input.companion) {
      // the deck exists already, so a retry has to delete it and start again
      await input.onDeckCreated(outcome.deckId);
      await setCompanion(outcome.deckId, input.companion);
    }
    return outcome.deckId;
  }
  if (outcome.deckId) {
    await input.onDeckCreated(outcome.deckId);
  }
  throw new MoxfieldContentError(outcome.message);
}

async function createDeckFolder(name: string): Promise<string> {
  const response = await authedRequest("POST", "/v1/deck-folders", { name });
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(`Moxfield would not create the folder (HTTP ${response.status}): ${describe(body)}`);
  }
  const parsed = parseCreateFolderResponse(body);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.id;
}

export async function getOrCreateFolderId(input: {
  folderId: string | null;
  folderName: string;
  onFolderCreated: (folderId: string) => Promise<void>;
}): Promise<string> {
  if (input.folderId) {
    return input.folderId;
  }
  const folderId = await createDeckFolder(input.folderName);
  await input.onFolderCreated(folderId);
  return folderId;
}
