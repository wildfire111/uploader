import { describe, expect, it, vi } from "vitest";
import { publishEntry, type PublishDeps } from "./publishEntry";
import type { Entry, Event } from "./types";

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "entry-1",
    eventId: "event-1",
    placingFrom: 1,
    placingTo: null,
    playerName: "Alex Morgan",
    deckName: "Blue Tempo",
    decklistRaw: "1 Island",
    moxfieldDeckId: null,
    moxfieldPendingDeckId: null,
    publishClaimedAt: null,
    placingAssigned: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    name: "TESTIQ",
    fullName: "Test Invitational Qualifier",
    date: "2026-10-04",
    attendance: 24,
    status: "submitted",
    createdBy: "creator@example.com",
    createdAt: "2026-10-01T00:00:00.000Z",
    moxfieldFolderId: null,
    metadataUnlocked: false,
    ...overrides,
  };
}

// fakes that record what happened; each test overrides just the part it is about
function makeDeps(overrides: Partial<PublishDeps> = {}) {
  const deps = {
    claimEntryForPublish: vi.fn(async () => ({ pendingDeckId: null as string | null })),
    getEntryById: vi.fn(async () => ({ moxfieldDeckId: null as string | null })),
    setPendingDeckId: vi.fn(async () => {}),
    markEntryPublished: vi.fn(async () => {}),
    releasePublishClaim: vi.fn(async () => {}),
    setEventMoxfieldFolderId: vi.fn(async () => {}),
    getOrCreateFolderId: vi.fn(async () => "folder-1"),
    prepareDecklist: vi.fn(async (raw: string) => ({ importText: raw, companion: null })),
    publishDeck: vi.fn(async () => "deck-1"),
    ...overrides,
  };
  return deps as typeof deps & PublishDeps;
}

describe("publishEntry", () => {
  it("returns the existing deck without touching the claim or Moxfield when already published", async () => {
    const deps = makeDeps();
    const outcome = await publishEntry(makeEntry({ moxfieldDeckId: "deck-9" }), makeEvent(), deps);
    expect(outcome).toEqual({ status: "published", moxfieldDeckId: "deck-9" });
    expect(deps.claimEntryForPublish).not.toHaveBeenCalled();
    expect(deps.publishDeck).not.toHaveBeenCalled();
  });

  it("publishes, records the deck, and does not release the claim", async () => {
    const deps = makeDeps();
    const outcome = await publishEntry(makeEntry(), makeEvent(), deps);
    expect(outcome).toEqual({ status: "published", moxfieldDeckId: "deck-1" });
    expect(deps.markEntryPublished).toHaveBeenCalledWith("entry-1", "deck-1");
    expect(deps.releasePublishClaim).not.toHaveBeenCalled();
  });

  it("sends Moxfield the title, description, decklist and folder", async () => {
    const deps = makeDeps();
    await publishEntry(makeEntry({ decklistRaw: "1 Flash\n1 Island" }), makeEvent(), deps);
    expect(deps.publishDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "01st Alex Morgan - Blue Tempo - TESTIQ",
        description: "04/10/26, Test Invitational Qualifier, 24 players",
        decklist: "1 Flash\n1 Island",
        folderId: "folder-1",
        pendingDeckId: null,
      })
    );
  });

  it("sends Moxfield the prepared decklist and the companion to set", async () => {
    const deps = makeDeps({
      prepareDecklist: vi.fn(async () => ({ importText: "1 Flash", companion: "Lurrus of the Dream-Den" })),
    });
    await publishEntry(makeEntry({ decklistRaw: "1 Flash\nCompanion\n1 Lurrus of the Dream-Den" }), makeEvent(), deps);
    expect(deps.prepareDecklist).toHaveBeenCalledWith("1 Flash\nCompanion\n1 Lurrus of the Dream-Den");
    expect(deps.publishDeck).toHaveBeenCalledWith(
      expect.objectContaining({ decklist: "1 Flash", companion: "Lurrus of the Dream-Den" })
    );
  });

  it("asks for the event's folder by its stored id, or its name when there is none yet", async () => {
    const deps = makeDeps();
    await publishEntry(makeEntry(), makeEvent({ moxfieldFolderId: "folder-7" }), deps);
    expect(deps.getOrCreateFolderId).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: "folder-7", folderName: "20261004 - Test Invitational Qualifier" })
    );
  });

  it("saves a newly created folder against the event", async () => {
    const deps = makeDeps({
      getOrCreateFolderId: vi.fn(async (input) => {
        await input.onFolderCreated("new-folder");
        return "new-folder";
      }),
    });
    await publishEntry(makeEntry(), makeEvent(), deps);
    expect(deps.setEventMoxfieldFolderId).toHaveBeenCalledWith("event-1", "new-folder");
  });

  it("passes the pending deck from a failed earlier attempt so it can be replaced", async () => {
    const deps = makeDeps({ claimEntryForPublish: vi.fn(async () => ({ pendingDeckId: "old-deck" })) });
    await publishEntry(makeEntry(), makeEvent(), deps);
    expect(deps.publishDeck).toHaveBeenCalledWith(expect.objectContaining({ pendingDeckId: "old-deck" }));
  });

  it("saves the pending deck id when Moxfield reports a deck it created but could not fill", async () => {
    const deps = makeDeps({
      publishDeck: vi.fn(async (input) => {
        await input.onDeckCreated("half-built");
        throw new Error("Moxfield could not read the decklist");
      }),
    });
    const outcome = await publishEntry(makeEntry(), makeEvent(), deps);
    expect(deps.setPendingDeckId).toHaveBeenCalledWith("entry-1", "half-built");
    expect(outcome.status).toBe("failed");
  });

  it("releases the claim and reports the error when Moxfield fails", async () => {
    const error = new Error("boom");
    const deps = makeDeps({ publishDeck: vi.fn(async () => Promise.reject(error)) });
    const outcome = await publishEntry(makeEntry(), makeEvent(), deps);
    expect(outcome).toEqual({ status: "failed", error });
    expect(deps.releasePublishClaim).toHaveBeenCalledWith("entry-1");
    expect(deps.markEntryPublished).not.toHaveBeenCalled();
  });

  it("releases the claim when the folder cannot be created", async () => {
    const deps = makeDeps({ getOrCreateFolderId: vi.fn(async () => Promise.reject(new Error("no folder"))) });
    const outcome = await publishEntry(makeEntry(), makeEvent(), deps);
    expect(outcome.status).toBe("failed");
    expect(deps.releasePublishClaim).toHaveBeenCalledWith("entry-1");
    expect(deps.publishDeck).not.toHaveBeenCalled();
  });

  it("releases the claim when recording the published deck fails", async () => {
    const deps = makeDeps({ markEntryPublished: vi.fn(async () => Promise.reject(new Error("db down"))) });
    const outcome = await publishEntry(makeEntry(), makeEvent(), deps);
    expect(outcome.status).toBe("failed");
    expect(deps.releasePublishClaim).toHaveBeenCalledWith("entry-1");
  });

  describe("when another publish holds the claim", () => {
    it("says it is busy and never reaches Moxfield", async () => {
      const deps = makeDeps({ claimEntryForPublish: vi.fn(async () => null) });
      const outcome = await publishEntry(makeEntry(), makeEvent(), deps);
      expect(outcome).toEqual({ status: "busy" });
      expect(deps.publishDeck).not.toHaveBeenCalled();
      expect(deps.releasePublishClaim).not.toHaveBeenCalled();
    });

    it("returns the deck when that publish has just finished", async () => {
      const deps = makeDeps({
        claimEntryForPublish: vi.fn(async () => null),
        getEntryById: vi.fn(async () => ({ moxfieldDeckId: "deck-5" })),
      });
      const outcome = await publishEntry(makeEntry(), makeEvent(), deps);
      expect(outcome).toEqual({ status: "published", moxfieldDeckId: "deck-5" });
      expect(deps.publishDeck).not.toHaveBeenCalled();
    });
  });
});
