// card name -> points, as stored in the database
export type PointsList = Record<string, number>;
// lookup by normalised name, built from a PointsList
export type PointsIndex = Map<string, number>;
// normalised Reserved List card names
export type ReservedIndex = Set<string>;
// normalised card names, including the front face of a double-faced card
export type CardNameSet = Set<string>;
// the reference data the checks use; null means that list isn't available
export type CheckLists = {
  points: PointsIndex | null;
  reserved: ReservedIndex | null;
  cardNames: CardNameSet | null;
};

export type Board = "main" | "side";
export type ParsedLine = { name: string; quantity: number; board: Board };

type AnalysedCard = ParsedLine & { points: number };
export type DecklistAnalysis = {
  cards: AnalysedCard[];
  mainCount: number;
  sideCount: number;
  // null when there is no points list to check against
  total: number | null;
  // the distinct Reserved List cards in the deck, as written in it
  reservedCards: string[];
  // set only when Lurrus is in the sideboard: the total if it is not the companion
  totalWithoutLurrus: number | null;
  // card names, as written, that are not in the card-name list
  unknownCards: string[];
  has: (name: string) => boolean;
};

export type DecklistWarning = {
  code: "points" | "deck-size" | "unknown-card" | "singleton";
  message: string;
};
