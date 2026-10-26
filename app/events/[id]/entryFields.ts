import { suggestNextPlacing } from "@/lib/placing";
import type { Entry, EntryInput } from "@/lib/types";
import { blankEntryFields, type EntryFieldValues } from "./types";

// what the right-hand pane is showing
export type Selection = { type: "none" } | { type: "new" } | { type: "existing"; entryId: string };

export function sortEntries(entries: Entry[]): Entry[] {
  // unplaced lists go last, in import order (their placeholder placings), as the server sorts them
  return [...entries].sort(
    (a, b) =>
      Number(b.placingAssigned) - Number(a.placingAssigned) ||
      a.placingFrom - b.placingFrom ||
      a.createdAt.localeCompare(b.createdAt)
  );
}

const MAX_MATCHES = 8;

// quick assign: every word typed has to be somewhere in the player or deck name
export function matchEntries(unplaced: Entry[], query: string): Entry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return unplaced
    .filter((entry) => {
      const haystack = `${entry.playerName} ${entry.deckName}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    })
    .slice(0, MAX_MATCHES);
}

export function entryToFields(entry: Entry): EntryFieldValues {
  // an unplaced list's placing is a placeholder, so the form starts blank
  if (!entry.placingAssigned) {
    return {
      placingFrom: "",
      placingTo: "",
      playerName: entry.playerName,
      deckName: entry.deckName,
      decklistRaw: entry.decklistRaw,
    };
  }
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
