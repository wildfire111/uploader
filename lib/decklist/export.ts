import { resolveAlias } from "./lists";
import { type ScannedLine, scanDecklist } from "./parse";
import type { AliasIndex } from "./types";

type Prepared = { importText: string; companion: string | null };

// The decklist as Moxfield should receive it. Moxfield only splits the sideboard on a blank line
// and a "Sideboard:" header, so the text is written out that way whatever the user wrote.
// Flavor names go in as the card's real name; set codes and foil markers are kept, and `*` points
// markers are dropped. The companion stays in the sideboard, since the card has to be in the deck
// before Moxfield can mark it as the companion; its name comes back so the caller can do that.
export function prepareForMoxfield(
  raw: string,
  { aliases, isCardName }: { aliases: AliasIndex | null; isCardName?: (name: string) => boolean }
): Prepared {
  const scanned = scanDecklist(raw, isCardName);
  const write = (line: ScannedLine) => `${line.quantityText}${resolveAlias(aliases, line.name)}${line.printing}`;
  const main = scanned.filter((line) => line.board === "main").map(write);
  const side = scanned.filter((line) => line.board === "side").map(write);
  const companion = scanned.find((line) => line.companion);
  return {
    importText: [...main, ...(side.length > 0 ? ["", "Sideboard:", ...side] : [])].join("\n"),
    companion: companion ? resolveAlias(aliases, companion.name) : null,
  };
}
