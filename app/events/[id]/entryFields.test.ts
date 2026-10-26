import { describe, expect, it } from "vitest";
import type { Entry } from "@/lib/types";
import {
  entryToFields,
  fieldsEqual,
  fieldsToInput,
  matchEntries,
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
    placingAssigned: true,
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

  it("puts unplaced lists after the placed ones, in the order they were imported", () => {
    const unplacedFirst = makeEntry({ id: "u1", placingFrom: 1, placingAssigned: false });
    const unplacedSecond = makeEntry({ id: "u2", placingFrom: 2, placingAssigned: false });
    const placed = makeEntry({ id: "p", placingFrom: 30 });
    expect(sortEntries([unplacedSecond, placed, unplacedFirst]).map((e) => e.id)).toEqual([
      "p",
      "u1",
      "u2",
    ]);
  });

  it("does not change the list it is given", () => {
    const entries = [makeEntry({ id: "a", placingFrom: 2 }), makeEntry({ id: "b", placingFrom: 1 })];
    sortEntries(entries);
    expect(entries.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("matchEntries", () => {
  const entries = [
    makeEntry({ id: "a", playerName: "Trent C", deckName: "Simic Shops" }),
    makeEntry({ id: "b", playerName: "Henry F", deckName: "Jeskai Midrange" }),
    makeEntry({ id: "c", playerName: "Trent W", deckName: "Jeskai Control" }),
  ];

  it("matches words in the player or deck name, in any case", () => {
    expect(matchEntries(entries, "trent").map((e) => e.id)).toEqual(["a", "c"]);
    expect(matchEntries(entries, "JESKAI").map((e) => e.id)).toEqual(["b", "c"]);
  });

  it("needs every word to match", () => {
    expect(matchEntries(entries, "trent jeskai").map((e) => e.id)).toEqual(["c"]);
  });

  it("shows the first few when nothing is typed, and caps the list", () => {
    const many = Array.from({ length: 20 }, (_, i) => makeEntry({ id: `e${i}` }));
    expect(matchEntries(many, "")).toHaveLength(8);
  });
});

describe("entryToFields and fieldsToInput", () => {
  it("leaves the placing blank for an unplaced list, so its placeholder never shows", () => {
    const fields = entryToFields(makeEntry({ placingFrom: 17, placingAssigned: false }));
    expect(fields.placingFrom).toBe("");
    expect(fields.placingTo).toBe("");
  });

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
