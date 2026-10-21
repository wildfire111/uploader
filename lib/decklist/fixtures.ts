import { analyseDecklist } from "./analyse";
import { buildAliasIndex, buildCardNameSet, buildPointsIndex, buildReservedIndex, parsePointsFile } from "./lists";
import type { AliasIndex, CardNameSet, PointsIndex, ReservedIndex } from "./types";

// shared by the decklist tests

export const POINTS_FILE = [
  "Ancestral Recall 5",
  "Black Lotus 5",
  "Thassa's Oracle 5",
  "Flash 3",
  "Tamiyo, Inquisitive Student // Tamiyo, Seasoned Scholar 2",
  "Lightning Bolt 1",
  "Lurrus of the Dream-Den 3",
  "Dauthi Voidwalker 4",
].join("\n");

export const index = buildPointsIndex(parsePointsFile(POINTS_FILE));
// a small stand-in for the full list from Scryfall
export const reserved = buildReservedIndex(["Taiga", "Badlands", "Black Lotus", "Ancestral Recall"]);

// a small stand-in for the full list of card names
export const knownCards = buildCardNameSet([
  "Flash",
  "Island",
  "Lightning Bolt",
  "Thassa's Oracle",
  "Delver of Secrets // Insectile Aberration",
  "Fire // Ice",
  "Dauthi Voidwalker",
]);

export const aliasIndex = buildAliasIndex({
  "Widow-Making Infiltrator": "Dauthi Voidwalker",
});

export function analyse(
  raw: string,
  points: PointsIndex | null,
  reservedIndex: ReservedIndex | null = null,
  cardNames: CardNameSet | null = null,
  aliases: AliasIndex | null = null,
  companions: CardNameSet | null = null
) {
  return analyseDecklist(raw, { points, reserved: reservedIndex, cardNames, aliases, companions });
}

export function filler(count: number, prefix = "Card"): string {
  return Array.from({ length: count }, (_, i) => `1 ${prefix} ${i + 1}`).join("\n");
}
