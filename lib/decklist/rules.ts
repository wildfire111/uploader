import { frontFace } from "./normalise";
import type { DecklistAnalysis, DecklistWarning } from "./types";

const MAINDECK_SIZE = 60;
const SIDEBOARD_SIZE = 15;
const DEFAULT_MIN_POINTS = 7;
const DEFAULT_MAX_POINTS = 8;

type PointRange = { min: number; max: number; reason: string | null };

const MAX_NAMED_RESERVED_CARDS = 3;

function describeCards(names: string[]): string {
  const shown = names.slice(0, MAX_NAMED_RESERVED_CARDS).join(", ");
  const extra = names.length - MAX_NAMED_RESERVED_CARDS;
  return extra > 0 ? `${shown} and ${extra} more` : shown;
}

// the one place card-specific adjustments to the allowed total belong.
// 8 points is only allowed with no Reserved List cards; with any, the total is 7.
export function allowedPointRange(analysis: DecklistAnalysis): PointRange {
  if (analysis.reservedCards.length > 0) {
    return {
      min: DEFAULT_MIN_POINTS,
      max: DEFAULT_MIN_POINTS,
      reason: `it has Reserved List cards (${describeCards(analysis.reservedCards)})`,
    };
  }
  return { min: DEFAULT_MIN_POINTS, max: DEFAULT_MAX_POINTS, reason: null };
}

function describeRange({ min, max }: PointRange): string {
  if (min === max) {
    return String(min);
  }
  return max - min === 1 ? `${min} or ${max}` : `between ${min} and ${max}`;
}

type Rule = (analysis: DecklistAnalysis) => DecklistWarning[];

const pointsRule: Rule = (analysis) => {
  if (analysis.total === null) {
    return [];
  }
  const range = allowedPointRange(analysis);
  if (analysis.total >= range.min && analysis.total <= range.max) {
    return [];
  }
  return [
    {
      code: "points",
      message: `This list totals ${analysis.total} points; expected ${describeRange(range)}${
        range.reason ? ` because ${range.reason}` : ""
      }.`,
    },
  ];
};

const deckSizeRule: Rule = (analysis) => {
  const warnings: DecklistWarning[] = [];
  if (analysis.mainCount !== MAINDECK_SIZE) {
    warnings.push({
      code: "deck-size",
      message: `Maindeck has ${analysis.mainCount} cards; expected ${MAINDECK_SIZE}.`,
    });
  }
  if (analysis.sideCount === 0) {
    warnings.push({
      code: "deck-size",
      message: `No sideboard found; expected ${SIDEBOARD_SIZE} cards.`,
    });
  } else if (analysis.sideCount !== SIDEBOARD_SIZE) {
    warnings.push({
      code: "deck-size",
      message: `Sideboard has ${analysis.sideCount} cards; expected ${SIDEBOARD_SIZE}.`,
    });
  }
  return warnings;
};

// the only cards that may appear more than once, as normaliseCardName writes them
const BASIC_LANDS = new Set(
  ["plains", "island", "swamp", "mountain", "forest", "wastes"].flatMap((land) => [
    land,
    `snow covered ${land}`,
  ])
);

const MAX_NAMED_DUPLICATES = 5;

// copies are counted across the maindeck and sideboard together
export const singletonRule: Rule = (analysis) => {
  const copies = new Map<string, { name: string; quantity: number }>();
  for (const card of analysis.cards) {
    // "Fire // Ice", "Fire/Ice" and "Fire" are one card, so copies are counted by front face
    const key = frontFace(card.name);
    if (BASIC_LANDS.has(key)) {
      continue;
    }
    const seen = copies.get(key);
    if (seen) {
      seen.quantity += card.quantity;
    } else {
      copies.set(key, { name: card.name, quantity: card.quantity });
    }
  }
  const duplicates = [...copies.values()].filter((card) => card.quantity > 1);
  const shown = duplicates.slice(0, MAX_NAMED_DUPLICATES);
  const warnings: DecklistWarning[] = shown.map((card) => ({
    code: "singleton",
    message: `"${card.name}" appears ${card.quantity} times; only basic lands can be repeated.`,
  }));
  const extra = duplicates.length - shown.length;
  if (extra > 0) {
    warnings.push({
      code: "singleton",
      message: `and ${extra} more repeated ${extra === 1 ? "card" : "cards"}.`,
    });
  }
  return warnings;
};

const MAX_NAMED_UNKNOWN_CARDS = 5;

const unknownCardsRule: Rule = (analysis) => {
  const shown = analysis.unknownCards.slice(0, MAX_NAMED_UNKNOWN_CARDS);
  const warnings: DecklistWarning[] = shown.map((name) => ({
    code: "unknown-card",
    message: `Unrecognised card: "${name}".`,
  }));
  const extra = analysis.unknownCards.length - shown.length;
  if (extra > 0) {
    warnings.push({
      code: "unknown-card",
      message: `and ${extra} more unrecognised ${extra === 1 ? "card" : "cards"}.`,
    });
  }
  return warnings;
};

const companionRule: Rule = (analysis) => {
  const warnings: DecklistWarning[] = [];
  const warn = (message: string) => warnings.push({ code: "companion", message });
  if (analysis.companion && analysis.extraCompanions.length > 0) {
    warn(
      `Only one companion can be declared; using "${analysis.companion}" and ignoring ${analysis.extraCompanions
        .map((name) => `"${name}"`)
        .join(", ")}.`
    );
  }
  if (analysis.companion && analysis.companionQuantity !== null) {
    warn(`The companion "${analysis.companion}" is listed ${analysis.companionQuantity} times; it counts as one card.`);
  }
  if (analysis.companion && analysis.companionEligible === false) {
    warn(`"${analysis.companion}" can't be a companion.`);
  }
  return warnings;
};

// append here for new checks
export const RULES: Rule[] = [pointsRule, deckSizeRule, singletonRule, unknownCardsRule, companionRule];

export function checkDecklist(analysis: DecklistAnalysis, rules: Rule[] = RULES): DecklistWarning[] {
  if (analysis.cards.length === 0) {
    return [];
  }
  return rules.flatMap((rule) => rule(analysis));
}
