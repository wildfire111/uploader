import { normaliseCardName } from "./normalise";
import { scanDecklist } from "./parse";

const SIDEBOARD_LINE = /sideboard|^(\/\/\s*)?sb\s*:?$/i;
const SIDEBOARD_PREFIX = /^sb:\s*/i;

// The decklist text with `name` (a sideboard card) made the companion, or with the companion
// cleared when `name` is null. The text is the only place the companion is kept, so this edits
// it the way a user would: a "Companion" line and the card go at the top, and a companion that is
// cleared or replaced goes back to the end of the sideboard.
export function setCompanion(raw: string, name: string | null, isCardName?: (name: string) => boolean): string {
  const lines = raw.split(/\r?\n/);
  const scanned = scanDecklist(raw, isCardName);
  const chosen =
    name === null
      ? null
      : scanned.find(
          (line) => line.board === "side" && !line.companion && normaliseCardName(line.name) === normaliseCardName(name)
        );
  if (name !== null && !chosen) {
    return raw;
  }

  const removed = new Set<number>();
  const putBack: string[] = [];
  for (const old of scanned.filter((line) => line.companion)) {
    removed.add(old.lineIndex);
    if (old.markerIndex !== undefined) {
      removed.add(old.markerIndex);
    }
    putBack.push(lines[old.lineIndex].trim());
  }
  if (chosen) {
    removed.add(chosen.lineIndex);
  }

  const kept = lines.filter((_, index) => !removed.has(index));
  if (putBack.length > 0 && !kept.some((line) => SIDEBOARD_LINE.test(line.trim()))) {
    kept.push("Sideboard");
  }
  kept.push(...putBack);
  const top = chosen ? ["Companion", lines[chosen.lineIndex].trim().replace(SIDEBOARD_PREFIX, "")] : [];
  return [...top, ...kept].join("\n");
}
