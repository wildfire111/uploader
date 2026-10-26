import { describe, expect, it } from "vitest";
import {
  areDetailsLocked,
  canDeleteEvent,
  canEditEntry,
  canEditEvent,
  canEditEventDetails,
  canPublishEvent,
  canRemoveOrDemoteUser,
  canReopenEvent,
  canReturnToDraft,
  canSubmitEvent,
  canUnlockMetadata,
} from "./permissions";
import type { AllowedUser, Entry, Event } from "./types";

const creator: AllowedUser = { email: "creator@example.com", isAdmin: false };
const otherVolunteer: AllowedUser = { email: "other@example.com", isAdmin: false };
const admin: AllowedUser = { email: "admin@example.com", isAdmin: true };

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    name: "Test Event",
    fullName: "Test Event, Full Name",
    date: "2026-09-14",
    attendance: 8,
    status: "draft",
    createdBy: creator.email,
    createdAt: "2026-09-01T00:00:00Z",
    moxfieldFolderId: null,
    metadataUnlocked: false,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "entry-1",
    eventId: "event-1",
    placingFrom: 1,
    placingTo: null,
    playerName: "Anthony P",
    deckName: "Storm",
    decklistRaw: "1 Lion's Eye Diamond",
    moxfieldDeckId: null,
    moxfieldPendingDeckId: null,
    publishClaimedAt: null,
    placingAssigned: true,
    createdAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("canEditEvent", () => {
  it("lets the creator edit their own draft", () => {
    expect(canEditEvent(creator, makeEvent({ status: "draft" }))).toBe(true);
  });

  it("does not let another volunteer edit someone else's draft", () => {
    expect(canEditEvent(otherVolunteer, makeEvent({ status: "draft" }))).toBe(false);
  });

  it("does not let an admin edit someone else's draft", () => {
    expect(canEditEvent(admin, makeEvent({ status: "draft" }))).toBe(false);
  });

  it("lets an admin edit a submitted event they didn't create", () => {
    expect(canEditEvent(admin, makeEvent({ status: "submitted" }))).toBe(true);
  });

  it("does not let the creator edit their own event once it's submitted", () => {
    expect(canEditEvent(creator, makeEvent({ status: "submitted" }))).toBe(false);
  });

  it("does not let anyone edit a published event", () => {
    expect(canEditEvent(creator, makeEvent({ status: "published" }))).toBe(false);
    expect(canEditEvent(admin, makeEvent({ status: "published" }))).toBe(false);
  });
});

describe("canDeleteEvent", () => {
  it("lets the creator delete their own draft", () => {
    expect(canDeleteEvent(creator, makeEvent({ status: "draft" }))).toBe(true);
  });

  it("does not let another volunteer delete someone else's draft", () => {
    expect(canDeleteEvent(otherVolunteer, makeEvent({ status: "draft" }))).toBe(false);
  });

  it("lets an admin delete a submitted event", () => {
    expect(canDeleteEvent(admin, makeEvent({ status: "submitted" }))).toBe(true);
  });

  it("lets an admin delete a published event", () => {
    expect(canDeleteEvent(admin, makeEvent({ status: "published" }))).toBe(true);
  });

  it("does not let a non-admin delete someone else's submitted event", () => {
    const event = makeEvent({ status: "submitted", createdBy: otherVolunteer.email });
    expect(canDeleteEvent(creator, event)).toBe(false);
  });
});

describe("canEditEntry", () => {
  it("follows the event's edit rule when the entry has no Moxfield id", () => {
    const event = makeEvent({ status: "draft" });
    const entry = makeEntry({ moxfieldDeckId: null });
    expect(canEditEntry(creator, event, entry)).toBe(true);
  });

  it("locks an entry with a Moxfield id even for the creator on their own draft", () => {
    const event = makeEvent({ status: "draft" });
    const entry = makeEntry({ moxfieldDeckId: "stub-123" });
    expect(canEditEntry(creator, event, entry)).toBe(false);
  });

  it("locks an entry with a Moxfield id even for an admin on a submitted event", () => {
    const event = makeEvent({ status: "submitted" });
    const entry = makeEntry({ moxfieldDeckId: "stub-123" });
    expect(canEditEntry(admin, event, entry)).toBe(false);
  });

  it("does not lock an entry that only has a pending deck, so a bad decklist can be fixed", () => {
    const event = makeEvent({ status: "submitted" });
    const entry = makeEntry({ moxfieldDeckId: null, moxfieldPendingDeckId: "abc123" });
    expect(canEditEntry(admin, event, entry)).toBe(true);
  });
});

describe("canSubmitEvent", () => {
  it("cannot submit an event with no entries", () => {
    expect(canSubmitEvent(creator, makeEvent({ status: "draft" }), [])).toBe(false);
  });

  it("lets the creator submit their own draft once it has an entry", () => {
    expect(canSubmitEvent(creator, makeEvent({ status: "draft" }), [makeEntry()])).toBe(true);
  });

  it("does not let another volunteer submit someone else's draft", () => {
    const event = makeEvent({ status: "draft" });
    expect(canSubmitEvent(otherVolunteer, event, [makeEntry()])).toBe(false);
  });

  it("cannot submit an event that isn't a draft", () => {
    const event = makeEvent({ status: "submitted" });
    expect(canSubmitEvent(creator, event, [makeEntry()])).toBe(false);
  });

  it("cannot submit while any list is still unplaced", () => {
    const entries = [makeEntry(), makeEntry({ id: "entry-2", placingAssigned: false })];
    expect(canSubmitEvent(creator, makeEvent({ status: "draft" }), entries)).toBe(false);
  });
});

describe("canPublishEvent", () => {
  it("cannot publish an event with no entries, even for an admin", () => {
    expect(canPublishEvent(admin, makeEvent({ status: "submitted" }), [])).toBe(false);
  });

  it("lets an admin publish a submitted event with entries", () => {
    const event = makeEvent({ status: "submitted" });
    expect(canPublishEvent(admin, event, [makeEntry()])).toBe(true);
  });

  it("does not let a non-admin publish", () => {
    const event = makeEvent({ status: "submitted" });
    expect(canPublishEvent(creator, event, [makeEntry()])).toBe(false);
  });

  it("cannot publish a draft event, even for an admin", () => {
    const event = makeEvent({ status: "draft" });
    expect(canPublishEvent(admin, event, [makeEntry()])).toBe(false);
  });

  it("cannot publish an already-published event, even for an admin", () => {
    const event = makeEvent({ status: "published" });
    expect(canPublishEvent(admin, event, [makeEntry()])).toBe(false);
  });
});

describe("areDetailsLocked", () => {
  it("is open while nothing has gone to Moxfield", () => {
    expect(areDetailsLocked(makeEvent({ status: "submitted" }), [makeEntry()])).toBe(false);
  });

  it("locks once an entry has a Moxfield deck", () => {
    const entries = [makeEntry({ moxfieldDeckId: "stub-123" })];
    expect(areDetailsLocked(makeEvent({ status: "submitted" }), entries)).toBe(true);
  });

  it("locks once the Moxfield folder exists, even if no deck made it", () => {
    const event = makeEvent({ status: "submitted", moxfieldFolderId: "folder-1" });
    expect(areDetailsLocked(event, [makeEntry()])).toBe(true);
  });

  it("is open again after an admin unlocks it", () => {
    const event = makeEvent({
      status: "submitted",
      moxfieldFolderId: "folder-1",
      metadataUnlocked: true,
    });
    expect(areDetailsLocked(event, [makeEntry({ moxfieldDeckId: "stub-123" })])).toBe(false);
  });
});

describe("canEditEventDetails", () => {
  const published = [makeEntry({ moxfieldDeckId: "stub-123" })];

  it("follows the event's edit rule while the details are open", () => {
    expect(canEditEventDetails(admin, makeEvent({ status: "submitted" }), [makeEntry()])).toBe(true);
    expect(canEditEventDetails(creator, makeEvent({ status: "draft" }), [makeEntry()])).toBe(true);
  });

  it("does not let an admin edit locked details", () => {
    const event = makeEvent({ status: "submitted", moxfieldFolderId: "folder-1" });
    expect(canEditEventDetails(admin, event, published)).toBe(false);
  });

  it("does not let the creator edit locked details after the event is handed back", () => {
    const event = makeEvent({ status: "draft", moxfieldFolderId: "folder-1" });
    expect(canEditEventDetails(creator, event, published)).toBe(false);
  });

  it("lets an admin edit unlocked details", () => {
    const event = makeEvent({
      status: "submitted",
      moxfieldFolderId: "folder-1",
      metadataUnlocked: true,
    });
    expect(canEditEventDetails(admin, event, published)).toBe(true);
  });

  it("does not let anyone edit a published event's details, even unlocked", () => {
    const event = makeEvent({ status: "published", metadataUnlocked: true });
    expect(canEditEventDetails(admin, event, published)).toBe(false);
  });
});

describe("canUnlockMetadata", () => {
  const published = [makeEntry({ moxfieldDeckId: "stub-123" })];
  const lockedEvent = makeEvent({ status: "submitted", moxfieldFolderId: "folder-1" });

  it("lets an admin unlock locked details on a submitted event", () => {
    expect(canUnlockMetadata(admin, lockedEvent, published)).toBe(true);
  });

  it("does not let a non-admin unlock", () => {
    expect(canUnlockMetadata(creator, lockedEvent, published)).toBe(false);
  });

  it("has nothing to unlock when the details are already open", () => {
    expect(canUnlockMetadata(admin, makeEvent({ status: "submitted" }), [makeEntry()])).toBe(false);
    expect(canUnlockMetadata(admin, { ...lockedEvent, metadataUnlocked: true }, published)).toBe(
      false
    );
  });

  it("only unlocks a submitted event", () => {
    expect(canUnlockMetadata(admin, { ...lockedEvent, status: "published" }, published)).toBe(false);
    expect(canUnlockMetadata(admin, { ...lockedEvent, status: "draft" }, published)).toBe(false);
  });
});

describe("canReopenEvent", () => {
  it("lets an admin reopen a published event", () => {
    expect(canReopenEvent(admin, makeEvent({ status: "published" }))).toBe(true);
  });

  it("does not let a non-admin reopen, including the creator", () => {
    expect(canReopenEvent(creator, makeEvent({ status: "published" }))).toBe(false);
  });

  it("only reopens a published event", () => {
    expect(canReopenEvent(admin, makeEvent({ status: "submitted" }))).toBe(false);
    expect(canReopenEvent(admin, makeEvent({ status: "draft" }))).toBe(false);
  });
});

describe("canReturnToDraft", () => {
  it("lets an admin return a submitted event to draft", () => {
    expect(canReturnToDraft(admin, makeEvent({ status: "submitted" }))).toBe(true);
  });

  it("does not let a non-admin return it", () => {
    expect(canReturnToDraft(creator, makeEvent({ status: "submitted" }))).toBe(false);
  });

  it("only returns a submitted event", () => {
    expect(canReturnToDraft(admin, makeEvent({ status: "published" }))).toBe(false);
    expect(canReturnToDraft(admin, makeEvent({ status: "draft" }))).toBe(false);
  });
});

describe("canRemoveOrDemoteUser", () => {
  it("does not let an admin remove or demote themselves", () => {
    expect(canRemoveOrDemoteUser(admin, admin.email)).toBe(false);
  });

  it("lets an admin remove or demote a different user", () => {
    expect(canRemoveOrDemoteUser(admin, otherVolunteer.email)).toBe(true);
    expect(canRemoveOrDemoteUser(admin, "another-admin@example.com")).toBe(true);
  });
});
