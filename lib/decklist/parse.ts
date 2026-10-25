import { isBasicLand, normaliseCardName } from "./normalise";
import type { Board, ParsedLine } from "./types";

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

// What the parser made of one line of the text. A divider is the sideboard header, or the blank
// line, that starts the sideboard; ignored lines (other headers, section labels, the Companion
// marker) are skipped. board is the board the line sits in, which for a card is the card's own.
export type LineRole = "card" | "divider" | "blank" | "ignored";
export type ClassifiedLine = {
  role: LineRole;
  board: Board;
  // the line the companion is declared on, or the marker above it
  companion?: true;
  // the card, when it was kept
  card?: ScannedLine;
};

// isCardName settles a line that mentions "companion": a card with that in its name is a card,
// anything else is the marker saying that the next line is the companion
export function scanDecklist(raw: string, isCardName?: (name: string) => boolean): ScannedLine[] {
  return scan(raw, isCardName).lines;
}

// one entry per line of the text, for showing the user how it was read
export function classifyLines(raw: string, isCardName?: (name: string) => boolean): ClassifiedLine[] {
  return scan(raw, isCardName).classified;
}

function scan(
  raw: string,
  isCardName?: (name: string) => boolean
): { lines: ScannedLine[]; classified: ClassifiedLine[] } {
  const lines: ScannedLine[] = [];
  const classified: ClassifiedLine[] = [];
  const rawLines = raw.split(/\r?\n/);
  // without a sideboard line, the first blank line after the maindeck starts the sideboard
  const splitOnBlank = !rawLines.some((line) => isSideboardLine(line.trim()));
  const lastContent = rawLines.findLastIndex((line) => line.trim() !== "");
  let inSideboard = false;
  let companionNext = false;
  let markerIndex = -1;
  let mainSeen = false;

  for (const [lineIndex, rawLine] of rawLines.entries()) {
    const line = rawLine.trim();
    if (line === "") {
      // a marker with nothing after it is just noise from the user's deck software
      // blank lines at the end have nothing after them to be a sideboard, e.g. the new line after
      // the card just typed
      const splits = splitOnBlank && mainSeen && !companionNext && lineIndex < lastContent;
      const starts = splits && !inSideboard;
      if (splits) {
        inSideboard = true;
      }
      classified.push({ role: starts ? "divider" : "blank", board: inSideboard ? "side" : "main" });
      companionNext = false;
      continue;
    }
    if (isSideboardLine(line)) {
      inSideboard = true;
      classified.push({ role: "divider", board: "side" });
      companionNext = false;
      continue;
    }
    if (OTHER_HEADER.test(line)) {
      classified.push({ role: "ignored", board: inSideboard ? "side" : "main" });
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
      classified.push({ role: "ignored", board: inSideboard ? "side" : "main" });
      continue;
    }
    const printing = (SET_CODE.exec(rest)?.[0] ?? "") + foil;
    const quantity = match ? Number(match[1].replace(/\D/g, "")) : 1;
    const isMarker = !hasSuffix && COMPANION_LINE.test(name) && !isCardName?.(name);

    if (hasSuffix) {
      const card: ScannedLine = { name, quantity, board: "side", companion: true, quantityText, printing, lineIndex, suffix: true };
      lines.push(card);
      classified.push({ role: "card", board: "side", companion: true, card });
      companionNext = false;
    } else if (isMarker) {
      companionNext = true;
      markerIndex = lineIndex;
      classified.push({ role: "ignored", board: "side", companion: true });
    } else if (companionNext) {
      const card: ScannedLine = { name, quantity, board: "side", companion: true, quantityText, printing, lineIndex, markerIndex };
      lines.push(card);
      classified.push({ role: "card", board: "side", companion: true, card });
      companionNext = false;
    } else {
      const board = prefixed || inSideboard ? "side" : "main";
      mainSeen ||= board === "main";
      const card: ScannedLine = { name, quantity, board, quantityText, printing, lineIndex };
      lines.push(card);
      classified.push({ role: "card", board, card });
    }
  }

  const labelled = withoutSectionLabels(lines);
  const kept = withoutListedCompanions(labelled);
  const keptSet = new Set(kept);
  const labelledSet = new Set(labelled);
  for (const line of classified) {
    if (line.card && !keptSet.has(line.card)) {
      // a label is skipped; a second copy of the companion is still a card, it just isn't counted
      if (!labelledSet.has(line.card)) {
        line.role = "ignored";
      }
      line.card = undefined;
    }
  }
  return { lines: kept, classified };
}

// Lists that write "Instants:" or "Creatures" above their cards give those lines no quantity, so
// once any card that isn't a basic land has one, the lines without are labels and not cards. A
// singleton list may leave every quantity off except the basics', so it keeps them all.
function withoutSectionLabels(lines: ScannedLine[]): ScannedLine[] {
  const quantified = lines.some((line) => line.quantityText !== "" && !isBasicLand(line.name));
  return quantified ? lines.filter((line) => line.quantityText !== "" || line.companion) : lines;
}

function isSideboardLine(line: string): boolean {
  return SIDEBOARD_LINE.test(line) || SIDEBOARD_ABBREVIATION.test(line);
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
