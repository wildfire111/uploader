import type { ParsedLine } from "./types";

// the same header Moxfield's importText splits on
const SIDEBOARD_HEADER = /^(\/\/\s*)?(sideboard|sb)\s*:?$/i;
const OTHER_HEADER = /^(\/\/\s*)?(deck|main|maindeck|mainboard|companion|commander)\s*:?$/i;
const SIDEBOARD_PREFIX = /^sb:\s*/i;
const QUANTITY = /^(\d+)[xX]?\s+(.+)$/;
const FOIL_MARKER = /\s+\*[a-z]+\*$/i;
const SET_CODE = /\s+\([a-z0-9]{2,6}\)(\s+\S+)?$/i;

export function parseDecklist(raw: string): ParsedLine[] {
  type Pending = ParsedLine & { group: number; prefixed: boolean };
  const lines: Pending[] = [];
  let inSideboard = false;
  let sawHeader = false;
  let group = 0;
  let cardsInGroup = false;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") {
      if (cardsInGroup) {
        group += 1;
        cardsInGroup = false;
      }
      continue;
    }
    if (SIDEBOARD_HEADER.test(line)) {
      inSideboard = true;
      sawHeader = true;
      continue;
    }
    if (OTHER_HEADER.test(line)) {
      continue;
    }

    const prefixed = SIDEBOARD_PREFIX.test(line);
    const body = line.replace(SIDEBOARD_PREFIX, "");
    const match = QUANTITY.exec(body);
    const quantity = match ? Number(match[1]) : 1;
    const name = (match ? match[2] : body).replace(FOIL_MARKER, "").replace(SET_CODE, "").trim();
    if (name === "") {
      continue;
    }
    lines.push({
      name,
      quantity,
      board: prefixed || inSideboard ? "side" : "main",
      group,
      prefixed,
    });
    cardsInGroup = true;
  }

  // a plain export: main, a blank line, then the sideboard
  const groups = new Set(lines.map((line) => line.group));
  const hasPrefix = lines.some((line) => line.prefixed);
  if (!sawHeader && !hasPrefix && groups.size === 2) {
    const secondGroup = Math.max(...groups);
    for (const line of lines) {
      if (line.group === secondGroup) {
        line.board = "side";
      }
    }
  }

  return lines.map(({ name, quantity, board }) => ({ name, quantity, board }));
}
