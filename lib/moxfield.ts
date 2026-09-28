import "server-only";
import { getValidAccessToken } from "./moxfieldAuth";
import { MoxfieldContentError, MoxfieldReauthRequiredError } from "./moxfieldErrors";
import { MOXFIELD_API, moxfieldFetch, readBody } from "./moxfieldHttp";
import { parseBulkEditResponse, parseCreateDeckResponse } from "./moxfieldResponse";

export type PublishDeckInput = {
  title: string;
  description: string;
  decklist: string;
  pendingDeckId: string | null;
  onDeckCreated: (deckId: string) => Promise<void>;
};

// "" clears a board, only safe because the deck is brand new
const OTHER_BOARDS = [
  "sideboard",
  "maybeboard",
  "commanders",
  "companions",
  "signatureSpells",
  "attractions",
  "contraptions",
  "planes",
  "schemes",
  "stickers",
  "tokens",
];

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

async function createDeck(title: string, description: string): Promise<string> {
  const response = await authedRequest("POST", "/v3/decks", {
    name: title,
    format: "highlanderAustralian",
    visibility: "public",
    description,
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(`Moxfield would not create the deck (HTTP ${response.status}): ${describe(body)}`);
  }
  const created = parseCreateDeckResponse(body);
  if (!created.ok) {
    throw new Error(created.message);
  }
  return created.publicId;
}

async function fillDeck(deckId: string, decklist: string): Promise<Response> {
  return authedRequest("PUT", `/v3/decks/${encodeURIComponent(deckId)}/bulk-edit`, {
    boards: { ...Object.fromEntries(OTHER_BOARDS.map((board) => [board, ""])), mainboard: decklist },
    playStyle: "paperDollars",
    pricingProvider: "cardkingdom",
    usePrefPrintings: false,
    ignoreFlavorNames: false,
  });
}

export async function publishDeck(input: PublishDeckInput): Promise<string> {
  // dev only, for testing the retry ui
  const simulated = process.env.MOXFIELD_SIMULATE_FAILURE;
  if (simulated && process.env.VERCEL_ENV !== "production") {
    throw new Error(`Simulated Moxfield failure: ${simulated}`);
  }

  let deckId = input.pendingDeckId;
  if (!deckId) {
    deckId = await createDeck(input.title, input.description);
    await input.onDeckCreated(deckId);
  }

  let response = await fillDeck(deckId, input.decklist);

  if (response.status === 404 && input.pendingDeckId && deckId === input.pendingDeckId) {
    deckId = await createDeck(input.title, input.description);
    await input.onDeckCreated(deckId);
    response = await fillDeck(deckId, input.decklist);
  }

  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(`Moxfield would not accept the decklist (HTTP ${response.status}): ${describe(body)}`);
  }

  // failures come back as a 200 with isSuccessful: false
  const outcome = parseBulkEditResponse(body);
  if (!outcome.ok) {
    throw new MoxfieldContentError(outcome.message);
  }
  return deckId;
}
