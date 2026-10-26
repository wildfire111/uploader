import { MAX_DECK_NAME_LENGTH, MAX_DECKLIST_LENGTH, MAX_PLAYER_NAME_LENGTH } from "../validation";

export type ImportedEntry = {
  playerName: string;
  deckName: string;
  decklistRaw: string;
};

// more lists than any event has players; stops a runaway payload, not a real import
export const MAX_IMPORT_ENTRIES = 5000;

const NO_CARDS_FOUND = "No cards found";

// a name typed in all capitals or all lower case is tidied; mixed case (DeAndre, McKay) is left alone
function capitaliseWord(word: string): string {
  if (word === word.toUpperCase() || word === word.toLowerCase()) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// "clarke, trent" -> "Trent C". A name that isn't "last, first" is kept as printed.
export function formatPlayerName(printed: string): string {
  const trimmed = printed.trim();
  const commaAt = trimmed.indexOf(",");
  if (commaAt === -1) {
    return trimmed;
  }
  const last = trimmed.slice(0, commaAt).trim();
  const first = trimmed.slice(commaAt + 1).trim();
  if (last === "" || first === "") {
    return trimmed;
  }
  const firstName = first.split(/\s+/).map(capitaliseWord).join(" ");
  return `${firstName} ${last.charAt(0).toUpperCase()}`;
}

function cutToLength(text: string, limit: number): string {
  return text.length > limit ? text.slice(0, limit) : text;
}

// Nothing in the PDF stops an import: a list with a missing name or too much text still gets
// created, with a stand-in value or cut to fit, and can be fixed up afterwards.
export function normaliseImportedEntry(entry: ImportedEntry): ImportedEntry {
  const playerName = entry.playerName.trim() || "Unknown player";
  const deckName = entry.deckName.trim() || "Unknown deck";

  let decklistRaw = entry.decklistRaw.trim() || NO_CARDS_FOUND;
  if (decklistRaw.length > MAX_DECKLIST_LENGTH) {
    const cut = decklistRaw.slice(0, MAX_DECKLIST_LENGTH);
    const lastBreak = cut.lastIndexOf("\n");
    decklistRaw = lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
  }

  return {
    playerName: cutToLength(playerName, MAX_PLAYER_NAME_LENGTH),
    deckName: cutToLength(deckName, MAX_DECK_NAME_LENGTH),
    decklistRaw,
  };
}
