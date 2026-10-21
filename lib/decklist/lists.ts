import { cardFaces, frontFace, normaliseCardName } from "./normalise";
import type { AliasIndex, AliasList, CardNameSet, PointsIndex, PointsList, ReservedIndex } from "./types";

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

// the parts of a Scryfall card that can carry another name for it
type AliasSource = {
  name: string;
  flavor_name?: unknown;
  printed_name?: unknown;
  card_faces?: { flavor_name?: unknown; printed_name?: unknown }[];
};

// Another name a card goes by, mapped to its real name. A flavor name (the Marvel set's
// "Widow-Making Infiltrator") is one; so is a printed name that differs from the card's, which is
// how Scryfall keeps some Secret Lair and Universes Beyond names (e.g. "Negan, the Cold-Blooded" on
// Malik, Grim Manipulator). A double-faced card has them on each face.
export function collectAliases(cards: AliasSource[]): AliasList {
  const aliases: AliasList = {};
  for (const card of cards) {
    const others = [
      card.flavor_name,
      card.printed_name,
      ...(card.card_faces ?? []).flatMap((face) => [face.flavor_name, face.printed_name]),
    ];
    for (const other of others) {
      if (typeof other === "string" && normaliseCardName(other) !== normaliseCardName(card.name)) {
        aliases[other] = card.name;
      }
    }
  }
  return aliases;
}

export function buildAliasIndex(list: AliasList): AliasIndex {
  return new Map(Object.entries(list).map(([alias, name]) => [normaliseCardName(alias), name]));
}

// the card's real name when `name` is a flavor name; otherwise `name` unchanged
export function resolveAlias(index: AliasIndex | null, name: string): string {
  return index?.get(normaliseCardName(name)) ?? name;
}
