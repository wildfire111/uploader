export type EntryFieldValues = {
  placingFrom: string;
  placingTo: string;
  playerName: string;
  deckName: string;
  decklistRaw: string;
};

export function blankEntryFields(): EntryFieldValues {
  return { placingFrom: "", placingTo: "", playerName: "", deckName: "", decklistRaw: "" };
}
