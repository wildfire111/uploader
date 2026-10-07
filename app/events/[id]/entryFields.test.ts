import { describe, expect, it } from "vitest";
import type { Entry } from "@/lib/types";
import {
  entryToFields,
  fieldsEqual,
  fieldsToInput,
  newEntryFields,
  pickDefaultSelection,
  sortEntries,
} from "./entryFields";
import type { EntryFieldValues } from "./types";

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
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("sortEntries", () => {
  it("orders by placing, then by when the entry was made", () => {
    const first = makeEntry({ id: "a", placingFrom: 2, createdAt: "2026-10-01T00:00:00.000Z" });
    const second = makeEntry({ id: "b", placingFrom: 2, createdAt: "2026-10-01T00:00:05.000Z" });
    const top = makeEntry({ id: "c", placingFrom: 1 });
    expect(sortEntries([second, first, top]).map((e) => e.id)).toEqual(["c", "a", "b"]);
  });

  it("does not change the list it is given", () => {
    const entries = [makeEntry({ id: "a", placingFrom: 2 }), makeEntry({ id: "b", placingFrom: 1 })];
    sortEntries(entries);
    expect(entries.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("entryToFields and fieldsToInput", () => {
  it("turns an entry into form text and back", () => {
    const entry = makeEntry({ placingFrom: 3, placingTo: 4 });
    expect(entryToFields(entry)).toEqual({
      placingFrom: "3",
      placingTo: "4",
      playerName: "Alex Morgan",
      deckName: "Blue Tempo",
      decklistRaw: "1 Island",
    });
    expect(fieldsToInput(entryToFields(entry))).toEqual({
      placingFrom: 3,
      placingTo: 4,
      playerName: "Alex Morgan",
      deckName: "Blue Tempo",
      decklistRaw: "1 Island",
    });
  });

  it("shows no placing-to as empty text, and reads empty or blank text as none", () => {
    expect(entryToFields(makeEntry()).placingTo).toBe("");
    expect(fieldsToInput({ ...entryToFields(makeEntry()), placingTo: "  " }).placingTo).toBeNull();
  });

  it("trims names but leaves the decklist exactly as typed", () => {
    const input = fieldsToInput({
      ...entryToFields(makeEntry()),
      playerName: "  Alex  ",
      deckName: " Tempo ",
      decklistRaw: "  1 Island\n",
    });
    expect(input).toMatchObject({ playerName: "Alex", deckName: "Tempo", decklistRaw: "  1 Island\n" });
  });
});

describe("fieldsEqual", () => {
  const base: EntryFieldValues = entryToFields(makeEntry());

  it("is true for the same values", () => {
    expect(fieldsEqual(base, { ...base })).toBe(true);
  });

  it.each(["placingFrom", "placingTo", "playerName", "deckName", "decklistRaw"] as const)(
    "is false when %s differs",
    (key) => {
      expect(fieldsEqual(base, { ...base, [key]: "changed" })).toBe(false);
    }
  );
});

describe("pickDefaultSelection", () => {
  it("opens the first entry when there are any", () => {
    expect(pickDefaultSelection([makeEntry({ id: "a" }), makeEntry({ id: "b" })], true)).toEqual({
      type: "existing",
      entryId: "a",
    });
  });

  it("opens a new entry when there are none and the user can edit", () => {
    expect(pickDefaultSelection([], true)).toEqual({ type: "new" });
  });

  it("shows nothing when there are none and the user cannot edit", () => {
    expect(pickDefaultSelection([], false)).toEqual({ type: "none" });
  });
});

describe("newEntryFields", () => {
  it("is blank apart from the suggested next placing", () => {
    const fields = newEntryFields([makeEntry({ placingFrom: 1 })]);
    expect(fields).toMatchObject({ placingFrom: "2", placingTo: "", playerName: "", deckName: "", decklistRaw: "" });
  });
});
