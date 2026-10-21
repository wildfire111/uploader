// card name -> points, as stored in the database
export type PointsList = Record<string, number>;
// lookup by normalised name, built from a PointsList
export type PointsIndex = Map<string, number>;
// normalised Reserved List card names
export type ReservedIndex = Set<string>;
// normalised card names, including the front face of a double-faced card
export type CardNameSet = Set<string>;
// flavor name -> the card's real (oracle) name, as stored in the database
export type AliasList = Record<string, string>;
// lookup by normalised flavor name, built from an AliasList
export type AliasIndex = Map<string, string>;
// the reference data the checks use; null means that list isn't available
export type CheckLists = {
  points: PointsIndex | null;
  reserved: ReservedIndex | null;
  cardNames: CardNameSet | null;
  aliases: AliasIndex | null;
  // normalised names of the cards that can be a companion
  companions: CardNameSet | null;
};

export type Board = "main" | "side";
// the companion is a sideboard card the player declares; only that line carries the flag
export type ParsedLine = { name: string; quantity: number; board: Board; companion?: true };

type AnalysedCard = ParsedLine & { points: number };
export type DecklistAnalysis = {
  cards: AnalysedCard[];
  mainCount: number;
  sideCount: number;
  // null when there is no points list to check against
  total: number | null;
  // the distinct Reserved List cards in the deck, as written in it
  reservedCards: string[];
  // card names, as written, that are not in the card-name list
  unknownCards: string[];
  // the declared companion, by its real name; every one after the first is in extraCompanions
  companion: string | null;
  extraCompanions: string[];
  // set when the companion was written with a quantity other than 1
  companionQuantity: number | null;
  // null when there is no companion or no list of eligible cards to check it against
  companionEligible: boolean | null;
  has: (name: string) => boolean;
};

export type DecklistWarning = {
  code: "points" | "deck-size" | "unknown-card" | "singleton" | "companion";
  message: string;
};
