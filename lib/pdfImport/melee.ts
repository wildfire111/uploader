// Reads the text of a Melee.gg "Decklist Multi-print" PDF into one entry per decklist. It works on
// text runs with page positions (what pdf.js hands back) so it can be tested without a PDF.

export type PdfTextItem = { str: string; x: number; y: number; width: number };
export type PdfPage = { width: number; items: PdfTextItem[] };

export type MeleeList = {
  // as printed, "last, first"
  playerName: string;
  deckName: string;
  // main deck, then a Sideboard line and the sideboard, one "1 Card Name" per line
  decklistRaw: string;
};

export class MeleeFormatError extends Error {}

const LIST_MARKER = /^Decklist\s+\d+\s+of\s+\d+$/;
const CARD_LINE = /^(\d+)\s+(.+)$/;
const SIDEBOARD_HEADER = /^sideboard\b/i;
// runs on one line are the same line when their baselines are this close (in points)
const SAME_LINE = 1.5;
// the right column starts about halfway across; the left one well before 40% of the width
const RIGHT_COLUMN_FROM = 0.4;

type Line = { y: number; text: string };

// joins the runs of one line left to right, adding a space where there is a visible gap
function joinRuns(runs: PdfTextItem[]): string {
  const sorted = [...runs].sort((a, b) => a.x - b.x);
  let text = "";
  let previousEnd = 0;
  for (const run of sorted) {
    const needsSpace =
      text !== "" && run.x - previousEnd > 2 && !/\s$/.test(text) && !/^\s/.test(run.str);
    text += (needsSpace ? " " : "") + run.str;
    previousEnd = run.x + run.width;
  }
  return text.replace(/\s+/g, " ").trim();
}

function groupIntoLines(items: PdfTextItem[]): Line[] {
  const groups: { y: number; runs: PdfTextItem[] }[] = [];
  for (const run of [...items].sort((a, b) => b.y - a.y)) {
    const group = groups.find((candidate) => Math.abs(candidate.y - run.y) <= SAME_LINE);
    if (group) {
      group.runs.push(run);
    } else {
      groups.push({ y: run.y, runs: [run] });
    }
  }
  return groups.map((group) => ({ y: group.y, text: joinRuns(group.runs) })).filter((line) => line.text !== "");
}

// the left column reads top to bottom, then the right one
function readBody(page: PdfPage, items: PdfTextItem[]): string[] {
  const splitAt = page.width * RIGHT_COLUMN_FROM;
  const left = items.filter((run) => run.x < splitAt);
  const right = items.filter((run) => run.x >= splitAt);
  return [...groupIntoLines(left), ...groupIntoLines(right)].map((line) => line.text);
}

function sameLineAs(label: PdfTextItem, items: PdfTextItem[]): PdfTextItem[] {
  return items.filter((run) => run !== label && Math.abs(run.y - label.y) <= SAME_LINE);
}

function readHeader(items: PdfTextItem[]): { playerName: string; deckName: string; bodyTopY: number } {
  const labelled = (text: string) => items.find((run) => run.str.trim() === text);
  const playerLabel = labelled("Player:");
  const deckLabel = labelled("Deck Name:");
  const printDateLabel = labelled("Print Date:");

  const valueRuns = (label: PdfTextItem | undefined, from: number, until: number) =>
    label
      ? joinRuns(sameLineAs(label, items).filter((run) => run.x >= from && run.x < until))
      : "";

  const playerName = playerLabel
    ? valueRuns(playerLabel, playerLabel.x + playerLabel.width, deckLabel?.x ?? Infinity)
    : "";
  const deckName = deckLabel ? valueRuns(deckLabel, deckLabel.x + deckLabel.width, Infinity) : "";

  // the cards start below the last row of the header table
  const lowestLabel = Math.min(...[playerLabel, deckLabel, printDateLabel].filter((l) => l).map((l) => l!.y));
  return { playerName, deckName, bodyTopY: Number.isFinite(lowestLabel) ? lowestLabel : Infinity };
}

function buildDecklist(lines: string[]): string {
  const main: string[] = [];
  const side: string[] = [];
  let inSideboard = false;
  for (const line of lines) {
    if (SIDEBOARD_HEADER.test(line)) {
      inSideboard = true;
      continue;
    }
    const card = CARD_LINE.exec(line);
    if (card) {
      (inSideboard ? side : main).push(`${card[1]} ${card[2]}`);
    }
    // anything else is a type header ("Creature (11)") or stray text
  }
  return [...main, ...(side.length > 0 ? ["Sideboard", ...side] : [])].join("\n");
}

export function parseMeleePdf(pages: PdfPage[]): MeleeList[] {
  const lists: { playerName: string; deckName: string; lines: string[] }[] = [];

  for (const page of pages) {
    const startsList = page.items.some((run) => LIST_MARKER.test(run.str.trim()));
    if (startsList) {
      const header = readHeader(page.items);
      // anything at or above the Print Date row is the header table, not cards
      const body = page.items.filter((run) => run.y < header.bodyTopY - SAME_LINE);
      lists.push({ playerName: header.playerName, deckName: header.deckName, lines: readBody(page, body) });
    } else if (lists.length > 0) {
      lists[lists.length - 1].lines.push(...readBody(page, page.items));
    }
  }

  if (lists.length === 0) {
    throw new MeleeFormatError("This doesn't look like a Melee.gg decklist print (no 'Decklist N of M' found).");
  }
  return lists.map((list) => ({
    playerName: list.playerName,
    deckName: list.deckName,
    decklistRaw: buildDecklist(list.lines),
  }));
}
