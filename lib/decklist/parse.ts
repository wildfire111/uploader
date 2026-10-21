import { normaliseCardName } from "./normalise";
import type { ParsedLine } from "./types";

const SIDEBOARD_LINE = /sideboard/i;
const SIDEBOARD_ABBREVIATION = /^(\/\/\s*)?sb\s*:?$/i;
const OTHER_HEADER = /^(\/\/\s*)?(deck|main|maindeck|mainboard|commander)\s*:?$/i;
const COMPANION_LINE = /companion/i;
const COMPANION_SUFFIX = /\s*\(companion\)(\s*\*+)?\s*$/i;
const SIDEBOARD_PREFIX = /^sb:\s*/i;
const QUANTITY = /^(\d+[xX]?\s+)(.+)$/;
const FOIL_MARKER = /\s+\*[a-z]+\*$/i;
const POINTS_MARKER = /\*/g;
const SET_CODE = /\s+\([a-z0-9]{2,6}\)(\s+\S+)?$/i;

// a parsed line plus what is needed to write it back out for Moxfield with only the name changed:
// "2x " + name + " (MAR) 63 *F*"
// lineIndex is the line in the text; a companion also has the line of the marker above it
export type ScannedLine = ParsedLine & {
  quantityText: string;
  printing: string;
  lineIndex: number;
  markerIndex?: number;
  // the companion was written as "(Companion)" after the card, not under a Companion line
  suffix?: true;
};

// isCardName settles a line that mentions "companion": a card with that in its name is a card,
// anything else is the marker saying that the next line is the companion
export function scanDecklist(raw: string, isCardName?: (name: string) => boolean): ScannedLine[] {
  const lines: ScannedLine[] = [];
  let inSideboard = false;
  let companionNext = false;
  let markerIndex = -1;

  for (const [lineIndex, rawLine] of raw.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (line === "") {
      // a marker with nothing after it is just noise from the user's deck software
      companionNext = false;
      continue;
    }
    if (SIDEBOARD_LINE.test(line) || SIDEBOARD_ABBREVIATION.test(line)) {
      inSideboard = true;
      companionNext = false;
      continue;
    }
    if (OTHER_HEADER.test(line)) {
      companionNext = false;
      continue;
    }

    const prefixed = SIDEBOARD_PREFIX.test(line);
    const withSuffix = line.replace(SIDEBOARD_PREFIX, "");
    const unprefixed = withSuffix.replace(COMPANION_SUFFIX, "");
    const hasSuffix = unprefixed !== withSuffix;
    const foil = FOIL_MARKER.exec(unprefixed)?.[0] ?? "";
    // the * after a card is the points spent on it, which the tool doesn't use
    const body = unprefixed.replace(FOIL_MARKER, "").replace(POINTS_MARKER, "").trim();
    const match = QUANTITY.exec(body);
    const quantityText = match ? match[1] : "";
    const rest = match ? match[2] : body;
    const name = rest.replace(SET_CODE, "").trim();
    if (name === "") {
      continue;
    }
    const printing = (SET_CODE.exec(rest)?.[0] ?? "") + foil;
    const quantity = match ? Number(match[1].replace(/\D/g, "")) : 1;
    const isMarker = !hasSuffix && COMPANION_LINE.test(name) && !isCardName?.(name);

    if (hasSuffix) {
      lines.push({ name, quantity, board: "side", companion: true, quantityText, printing, lineIndex, suffix: true });
      companionNext = false;
    } else if (isMarker) {
      companionNext = true;
      markerIndex = lineIndex;
    } else if (companionNext) {
      lines.push({ name, quantity, board: "side", companion: true, quantityText, printing, lineIndex, markerIndex });
      companionNext = false;
    } else {
      const board = prefixed || inSideboard ? "side" : "main";
      lines.push({ name, quantity, board, quantityText, printing, lineIndex });
    }
  }

  return withoutListedCompanions(lines);
}

export function parseDecklist(raw: string, isCardName?: (name: string) => boolean): ParsedLine[] {
  return scanDecklist(raw, isCardName).map(({ name, quantity, board, companion }) =>
    companion ? { name, quantity, board, companion } : { name, quantity, board }
  );
}

// a companion that is also in the sideboard is still one card
function withoutListedCompanions(lines: ScannedLine[]): ScannedLine[] {
  const companions = new Set(lines.filter((line) => line.companion).map((line) => normaliseCardName(line.name)));
  if (companions.size === 0) {
    return lines;
  }
  return lines.filter(
    (line) => line.companion || line.board !== "side" || !companions.has(normaliseCardName(line.name))
  );
}
