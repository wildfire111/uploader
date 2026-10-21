import "server-only";
import { cardNameCheck } from "./decklist/analyse";
import { buildAliasIndex, buildCardNameSet } from "./decklist/lists";
import type { AliasIndex } from "./decklist/types";
import { cardAliasesList, cardNamesList } from "./referenceLists";

// The stored lists the parser asks "is this line a card?" with. If one is missing the decklist is
// read without its help: a flavor name stays as written, and every "companion" line is a marker.
export async function loadCardNameCheck(): Promise<{
  aliases: AliasIndex | null;
  isCardName: ((name: string) => boolean) | undefined;
}> {
  const [storedAliases, storedNames] = await Promise.all([cardAliasesList.get(), cardNamesList.get()]);
  const aliases = storedAliases ? buildAliasIndex(storedAliases.data) : null;
  const cardNames = storedNames ? buildCardNameSet(storedNames.data) : null;
  return {
    aliases,
    isCardName: cardNameCheck({ points: null, reserved: null, cardNames, aliases, companions: null }),
  };
}
