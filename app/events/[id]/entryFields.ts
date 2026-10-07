import { suggestNextPlacing } from "@/lib/placing";
import type { Entry, EntryInput } from "@/lib/types";
import { blankEntryFields, type EntryFieldValues } from "./types";

// what the right-hand pane is showing
export type Selection = { type: "none" } | { type: "new" } | { type: "existing"; entryId: string };

export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) => a.placingFrom - b.placingFrom || a.createdAt.localeCompare(b.createdAt)
  );
}

export function entryToFields(entry: Entry): EntryFieldValues {
  return {
    placingFrom: String(entry.placingFrom),
    placingTo: entry.placingTo === null ? "" : String(entry.placingTo),
    playerName: entry.playerName,
    deckName: entry.deckName,
    decklistRaw: entry.decklistRaw,
  };
}

// blank fields for a new entry, with the placing filled in
export function newEntryFields(entries: Entry[]): EntryFieldValues {
  const suggestion = suggestNextPlacing(entries);
  return {
    ...blankEntryFields(),
    placingFrom: String(suggestion.placingFrom),
    placingTo: suggestion.placingTo === null ? "" : String(suggestion.placingTo),
  };
}

export function pickDefaultSelection(entries: Entry[], canEdit: boolean): Selection {
  if (entries.length > 0) {
    return { type: "existing", entryId: entries[0].id };
  }
  return canEdit ? { type: "new" } : { type: "none" };
}

export function fieldsEqual(a: EntryFieldValues, b: EntryFieldValues): boolean {
  return (
    a.placingFrom === b.placingFrom &&
    a.placingTo === b.placingTo &&
    a.playerName === b.playerName &&
    a.deckName === b.deckName &&
    a.decklistRaw === b.decklistRaw
  );
}

export function fieldsToInput(fields: EntryFieldValues): EntryInput {
  return {
    placingFrom: Number(fields.placingFrom),
    placingTo: fields.placingTo.trim() === "" ? null : Number(fields.placingTo),
    playerName: fields.playerName.trim(),
    deckName: fields.deckName.trim(),
    decklistRaw: fields.decklistRaw,
  };
}
