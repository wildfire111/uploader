import { pointsFor } from "./lists";
import { normaliseCardName } from "./normalise";
import { parseDecklist } from "./parse";
import type { Board, CardNameSet, CheckLists, DecklistAnalysis, ParsedLine } from "./types";

// Lurrus is only pointed when played as the companion, which a decklist doesn't say, so a
// sideboard Lurrus is allowed to count either way.
const LURRUS = "lurrus of the dream den";

export function analyseDecklist(raw: string, lists: CheckLists): DecklistAnalysis {
  const { points, reserved, cardNames } = lists;
  const parsed = parseDecklist(raw);
  const cards = parsed.map((line) => ({
    ...line,
    points: points ? pointsFor(points, line.name) : 0,
  }));
  const names = new Set(cards.map((card) => normaliseCardName(card.name)));
  const lurrusPoints = cards
    .filter((card) => card.board === "side" && normaliseCardName(card.name) === LURRUS)
    .reduce((sum, card) => sum + card.points * card.quantity, 0);
  const count = (board: Board) =>
    cards.filter((card) => card.board === board).reduce((sum, card) => sum + card.quantity, 0);
  const total = points ? cards.reduce((sum, card) => sum + card.points * card.quantity, 0) : null;
  const withoutLurrus = total !== null && lurrusPoints > 0 ? total - lurrusPoints : null;
  return {
    cards,
    mainCount: count("main"),
    sideCount: count("side"),
    total,
    totalWithoutLurrus: withoutLurrus,
    unknownCards: cardNames ? findUnknownCards(cards, cardNames) : [],
    reservedCards: reserved
      ? [...new Set(cards.filter((card) => reserved.has(normaliseCardName(card.name))).map((card) => card.name))]
      : [],
    has: (name) => names.has(normaliseCardName(name)),
  };
}

function findUnknownCards(cards: ParsedLine[], known: CardNameSet): string[] {
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const card of cards) {
    const key = normaliseCardName(card.name);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (!known.has(key)) {
      unknown.push(card.name);
    }
  }
  return unknown;
}
