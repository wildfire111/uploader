import { cardFaces, frontFace, normaliseCardName } from "./normalise";
import type { CardNameSet, PointsIndex, PointsList, ReservedIndex } from "./types";

// each line is "Card Name 3"; the points are whatever follows the last space
export function parsePointsFile(text: string): PointsList {
  const list: PointsList = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace === -1) {
      continue;
    }
    const name = trimmed.slice(0, lastSpace).trim();
    const pointsText = trimmed.slice(lastSpace + 1);
    if (!name || !/^\d+$/.test(pointsText)) {
      continue;
    }
    list[name] = Number(pointsText);
  }
  return list;
}

// a double-faced card is findable by its full name or by either face
export function buildPointsIndex(list: PointsList): PointsIndex {
  const index: PointsIndex = new Map();
  for (const [name, points] of Object.entries(list)) {
    index.set(normaliseCardName(name), points);
  }
  for (const [name, points] of Object.entries(list)) {
    for (const face of cardFaces(name)) {
      if (!index.has(face)) {
        index.set(face, points);
      }
    }
  }
  return index;
}

export function buildReservedIndex(names: string[]): ReservedIndex {
  return new Set(names.map(normaliseCardName));
}

export function pointsFor(index: PointsIndex, name: string): number {
  const whole = index.get(normaliseCardName(name));
  if (whole !== undefined) {
    return whole;
  }
  for (const face of cardFaces(name)) {
    const found = index.get(face);
    if (found !== undefined) {
      return found;
    }
  }
  return 0;
}

// Every card name as a decklist may write it: the whole name, and a double-faced, split or
// adventure card by its front face too. A back face on its own is not accepted.
export function buildCardNameSet(names: string[]): CardNameSet {
  const set: CardNameSet = new Set();
  for (const name of names) {
    set.add(normaliseCardName(name));
    set.add(frontFace(name));
  }
  set.delete("");
  return set;
}
