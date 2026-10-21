import { pointsFor, resolveAlias } from "./lists";
import { normaliseCardName } from "./normalise";
import { parseDecklist } from "./parse";
import type { Board, CardNameSet, CheckLists, DecklistAnalysis, ParsedLine } from "./types";

// Settles whether a line that mentions "companion" is a card (e.g. "Faithful Companion") or the
// marker above the companion. Without the card-name list every such line is taken as the marker.
export function cardNameCheck({ cardNames, aliases }: CheckLists): ((name: string) => boolean) | undefined {
  return cardNames ? (name) => cardNames.has(normaliseCardName(resolveAlias(aliases, name))) : undefined;
}

export function analyseDecklist(raw: string, lists: CheckLists): DecklistAnalysis {
  const { points, reserved, cardNames, aliases, companions } = lists;
  const declared = parseDecklist(raw, cardNameCheck(lists)).map((line) => ({
    ...line,
    // a flavor name counts as the card it is printed on, so everything below sees the real name
    name: resolveAlias(aliases, line.name),
  }));
  // A companion is only pointed when played as one, so a card that could be the companion counts
  // only if the decklist declares it, in the maindeck or the sideboard. A list that forgets falls
  // short of its points.
  const isUndeclaredCompanion = (line: ParsedLine) =>
    !line.companion && companions?.has(normaliseCardName(line.name)) === true;
  const companionLines = declared.filter((line) => line.companion);
  // there is only ever one copy of the companion, whatever was written
  const cards = declared.map((line) => ({
    ...line,
    quantity: line.companion ? 1 : line.quantity,
    points: points && !isUndeclaredCompanion(line) ? pointsFor(points, line.name) : 0,
  }));
  const names = new Set(cards.map((card) => normaliseCardName(card.name)));
  const count = (board: Board) =>
    cards.filter((card) => card.board === board).reduce((sum, card) => sum + card.quantity, 0);
  const total = points ? cards.reduce((sum, card) => sum + card.points * card.quantity, 0) : null;
  return {
    cards,
    mainCount: count("main"),
    sideCount: count("side"),
    total,
    unknownCards: cardNames ? findUnknownCards(cards, cardNames) : [],
    companion: companionLines[0]?.name ?? null,
    extraCompanions: companionLines.slice(1).map((line) => line.name),
    companionQuantity: companionLines[0] && companionLines[0].quantity !== 1 ? companionLines[0].quantity : null,
    companionEligible: companions && companionLines[0] ? companions.has(normaliseCardName(companionLines[0].name)) : null,
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
