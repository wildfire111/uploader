import { formatDeckDescription } from "./description";
import { formatDeckFolderName } from "./folderName";
import { formatDeckTitle } from "./title";
import type { Entry, Event } from "./types";

// everything publishing touches outside this file, so the flow can be tested without a database
// or Moxfield; app/api/entries/[id]/publish/route.ts passes in the real ones
export type PublishDeps = {
  claimEntryForPublish(entryId: string): Promise<{ pendingDeckId: string | null } | null>;
  getEntryById(entryId: string): Promise<Pick<Entry, "moxfieldDeckId"> | null>;
  setPendingDeckId(entryId: string, deckId: string): Promise<void>;
  markEntryPublished(entryId: string, deckId: string): Promise<void>;
  releasePublishClaim(entryId: string): Promise<void>;
  setEventMoxfieldFolderId(eventId: string, folderId: string): Promise<void>;
  getOrCreateFolderId(input: {
    folderId: string | null;
    folderName: string;
    onFolderCreated: (folderId: string) => Promise<void>;
  }): Promise<string>;
  publishDeck(input: {
    title: string;
    description: string;
    decklist: string;
    folderId: string;
    pendingDeckId: string | null;
    onDeckCreated: (deckId: string) => Promise<void>;
  }): Promise<string>;
};

type PublishOutcome =
  | { status: "published"; moxfieldDeckId: string }
  // someone else is publishing this entry right now
  | { status: "busy" }
  // the claim has been released, so the entry can be retried
  | { status: "failed"; error: unknown };

export async function publishEntry(
  entry: Entry,
  event: Event,
  deps: PublishDeps
): Promise<PublishOutcome> {
  if (entry.moxfieldDeckId !== null) {
    return { status: "published", moxfieldDeckId: entry.moxfieldDeckId };
  }

  const claim = await deps.claimEntryForPublish(entry.id);
  if (!claim) {
    // the publish that held the claim may have just finished
    const current = await deps.getEntryById(entry.id);
    return current?.moxfieldDeckId
      ? { status: "published", moxfieldDeckId: current.moxfieldDeckId }
      : { status: "busy" };
  }

  try {
    const folderId = await deps.getOrCreateFolderId({
      folderId: event.moxfieldFolderId,
      folderName: formatDeckFolderName({ date: event.date, fullName: event.fullName }),
      onFolderCreated: (createdFolderId) =>
        deps.setEventMoxfieldFolderId(event.id, createdFolderId),
    });
    const moxfieldDeckId = await deps.publishDeck({
      title: formatDeckTitle({ ...entry, eventName: event.name }),
      description: formatDeckDescription({
        date: event.date,
        fullName: event.fullName,
        attendance: event.attendance,
      }),
      decklist: entry.decklistRaw,
      folderId,
      pendingDeckId: claim.pendingDeckId,
      onDeckCreated: (deckId) => deps.setPendingDeckId(entry.id, deckId),
    });
    await deps.markEntryPublished(entry.id, moxfieldDeckId);
    return { status: "published", moxfieldDeckId };
  } catch (error) {
    await deps.releasePublishClaim(entry.id);
    return { status: "failed", error };
  }
}
