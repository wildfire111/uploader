import { resolveAlias } from "./lists";
import type { AliasIndex } from "./types";

// quantity and board prefix, the name, then the set code and foil marker the parser strips
const LINE = /^(\s*(?:sb:\s*)?(?:\d+[xX]?\s+)?)(.+?)((?:\s+\([a-z0-9]{2,6}\)(?:\s+\S+)?)?(?:\s+\*[a-z]+\*)?\s*)$/i;

// the decklist with each flavor name swapped for the card's real name, so Moxfield can find it
export function replaceAliases(raw: string, aliases: AliasIndex | null): string {
  if (!aliases || aliases.size === 0) {
    return raw;
  }
  return raw
    .split("\n")
    .map((line) => {
      const match = LINE.exec(line);
      return match ? `${match[1]}${resolveAlias(aliases, match[2])}${match[3]}` : line;
    })
    .join("\n");
}
