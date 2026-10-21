import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateFolderId, publishDeck } from "@/lib/moxfield";
import {
  MoxfieldContentError,
  MoxfieldRateLimitedError,
  MoxfieldReauthRequiredError,
  MoxfieldUserAgentMissingError,
} from "@/lib/moxfieldErrors";
import {
  claimEntryForPublish,
  getEntryById,
  markEntryPublished,
  releasePublishClaim,
  setPendingDeckId,
} from "@/lib/queries/entries";
import { getEventById, setEventMoxfieldFolderId } from "@/lib/queries/events";
import { cardNameCheck } from "@/lib/decklist/analyse";
import { prepareForMoxfield } from "@/lib/decklist/export";
import { buildAliasIndex, buildCardNameSet } from "@/lib/decklist/lists";
import { cardAliasesList, cardNamesList } from "@/lib/referenceLists";
import { publishEntry, type PublishDeps } from "@/lib/publishEntry";

// the publish claim (PUBLISH_CLAIM_MINUTES in lib/queries/entries.ts) has to outlast this
export const maxDuration = 300;

const publishDeps: PublishDeps = {
  claimEntryForPublish,
  getEntryById,
  setPendingDeckId,
  markEntryPublished,
  releasePublishClaim,
  setEventMoxfieldFolderId,
  getOrCreateFolderId,
  // the stored lists are enough; if one is missing the decklist goes up without its help
  prepareDecklist: async (raw) => {
    const [storedAliases, storedNames] = await Promise.all([cardAliasesList.get(), cardNamesList.get()]);
    const aliases = storedAliases ? buildAliasIndex(storedAliases.data) : null;
    const cardNames = storedNames ? buildCardNameSet(storedNames.data) : null;
    return prepareForMoxfield(raw, {
      aliases,
      isCardName: cardNameCheck({ points: null, reserved: null, cardNames, aliases, companions: null }),
    });
  },
  publishDeck,
};

function statusForError(error: unknown): number {
  if (error instanceof MoxfieldReauthRequiredError || error instanceof MoxfieldUserAgentMissingError) {
    return 503;
  }
  if (error instanceof MoxfieldContentError) {
    return 422;
  }
  if (error instanceof MoxfieldRateLimitedError) {
    return 429;
  }
  return 502;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "You don't have permission to publish." }, { status: 403 });
  }

  const { id } = await params;
  const entry = await getEntryById(id);
  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  const event = await getEventById(entry.eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (event.status !== "submitted") {
    return NextResponse.json(
      { error: "This event is not submitted for review." },
      { status: 400 }
    );
  }

  const outcome = await publishEntry(entry, event, publishDeps);

  if (outcome.status === "published") {
    return NextResponse.json({ moxfieldDeckId: outcome.moxfieldDeckId });
  }
  if (outcome.status === "busy") {
    return NextResponse.json({ error: "This entry is already being published." }, { status: 409 });
  }

  const message =
    outcome.error instanceof Error ? outcome.error.message : "Could not publish this entry.";
  console.error(`Publish failed for entry ${id} (event ${event.id}): ${message}`);
  return NextResponse.json({ error: message }, { status: statusForError(outcome.error) });
}
