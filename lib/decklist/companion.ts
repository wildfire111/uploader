import { normaliseCardName } from "./normalise";
import { scanDecklist } from "./parse";

const SIDEBOARD_LINE = /sideboard|^(\/\/\s*)?sb\s*:?$/i;
const COMPANION_SUFFIX = /\s*\(companion\)(\s*\*+)?\s*$/i;
const MARK = " (Companion)";

type IsCardName = (name: string) => boolean;

// The decklist text where every companion is written as "(Companion)" after its card in the
// sideboard. A Companion line with the card under it, which is how some deck software exports it,
// is moved into the sideboard and marked; if the card is already in the sideboard that line is
// marked instead of adding a second copy.
export function normaliseCompanions(raw: string, isCardName?: IsCardName): string {
  let text = raw;
  for (;;) {
    const found = scanDecklist(text, isCardName).find((line) => line.companion && line.markerIndex !== undefined);
    if (!found || found.markerIndex === undefined) {
      return text;
    }
    const lines = text.split(/\r?\n/);
    const card = lines[found.lineIndex].trim();
    const rest = lines.filter((_, index) => index !== found.markerIndex && index !== found.lineIndex);

    const listed = scanDecklist(rest.join("\n"), isCardName).find(
      (line) => line.board === "side" && !line.companion && normaliseCardName(line.name) === normaliseCardName(found.name)
    );
    if (listed) {
      rest[listed.lineIndex] = `${rest[listed.lineIndex].trimEnd()}${MARK}`;
      text = rest.join("\n");
      continue;
    }
    while (rest.length > 0 && rest[rest.length - 1].trim() === "") {
      rest.pop();
    }
    if (!rest.some((line) => SIDEBOARD_LINE.test(line.trim()))) {
      rest.push("Sideboard");
    }
    rest.push(`${card}${MARK}`);
    text = rest.join("\n");
  }
}

// The decklist text with `name` (a sideboard card) made the companion, or with the companion
// cleared when `name` is null. The text is the only place the companion is kept, so this edits
// it the way a user would, marking the card "(Companion)" where it already is.
export function setCompanion(raw: string, name: string | null, isCardName?: IsCardName): string {
  const cleared = normaliseCompanions(raw, isCardName)
    .split(/\r?\n/)
    .map((line) => line.replace(COMPANION_SUFFIX, ""))
    .join("\n");
  if (name === null) {
    return cleared;
  }
  const chosen = scanDecklist(cleared, isCardName).find(
    (line) => line.board === "side" && normaliseCardName(line.name) === normaliseCardName(name)
  );
  if (!chosen) {
    return raw;
  }
  const lines = cleared.split("\n");
  lines[chosen.lineIndex] = `${lines[chosen.lineIndex].trimEnd()}${MARK}`;
  return lines.join("\n");
}
