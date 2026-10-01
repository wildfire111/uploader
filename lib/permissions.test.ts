import { describe, expect, it } from "vitest";
import {
  canDeleteEntry,
  canDeleteEvent,
  canEditEntry,
  canEditEvent,
  canPublishEntry,
  canPublishEvent,
  canRemoveOrDemoteUser,
  canSubmitEvent,
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

describe("canEditEntry / canDeleteEntry", () => {
  it("follows the event's edit rule when the entry has no Moxfield id", () => {
    const event = makeEvent({ status: "draft" });
    const entry = makeEntry({ moxfieldDeckId: null });
    expect(canEditEntry(creator, event, entry)).toBe(true);
    expect(canDeleteEntry(creator, event, entry)).toBe(true);
  });

  it("locks an entry with a Moxfield id even for the creator on their own draft", () => {
    const event = makeEvent({ status: "draft" });
    const entry = makeEntry({ moxfieldDeckId: "stub-123" });
    expect(canEditEntry(creator, event, entry)).toBe(false);
    expect(canDeleteEntry(creator, event, entry)).toBe(false);
  });

  it("locks an entry with a Moxfield id even for an admin on a submitted event", () => {
    const event = makeEvent({ status: "submitted" });
    const entry = makeEntry({ moxfieldDeckId: "stub-123" });
    expect(canEditEntry(admin, event, entry)).toBe(false);
    expect(canDeleteEntry(admin, event, entry)).toBe(false);
  });

  it("does not lock an entry that only has a pending deck, so a bad decklist can be fixed", () => {
    const event = makeEvent({ status: "submitted" });
    const entry = makeEntry({ moxfieldDeckId: null, moxfieldPendingDeckId: "abc123" });
    expect(canEditEntry(admin, event, entry)).toBe(true);
    expect(canDeleteEntry(admin, event, entry)).toBe(true);
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

describe("canPublishEntry", () => {
  it("cannot publish an entry in a draft event, even for an admin", () => {
    expect(canPublishEntry(admin, makeEvent({ status: "draft" }))).toBe(false);
  });

  it("cannot publish an entry in an already-published event, even for an admin", () => {
    expect(canPublishEntry(admin, makeEvent({ status: "published" }))).toBe(false);
  });

  it("lets an admin publish an entry in a submitted event", () => {
    expect(canPublishEntry(admin, makeEvent({ status: "submitted" }))).toBe(true);
  });

  it("does not let a non-admin publish an entry", () => {
    expect(canPublishEntry(creator, makeEvent({ status: "submitted" }))).toBe(false);
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
