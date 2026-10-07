import { formatPlacing, type PlacingRange } from "./placing";

type DeckTitleInput = PlacingRange & {
  playerName: string;
  deckName: string;
  eventName: string;
};

// e.g. "01st/04th Anthony P - Gluten Free Storm - GGGongIQ26"
export function formatDeckTitle(input: DeckTitleInput): string {
  const placing = formatPlacing(input);
  return `${placing} ${input.playerName} - ${input.deckName} - ${input.eventName}`;
}

// moxfield only takes names of 2-100 characters
const MIN_TITLE_LENGTH = 2;
const MAX_TITLE_LENGTH = 100;

export function checkTitleLength(title: string): string | null {
  if (title.length > MAX_TITLE_LENGTH) {
    const over = title.length - MAX_TITLE_LENGTH;
    return `The deck title would be ${over} character${over === 1 ? "" : "s"} over Moxfield's ${MAX_TITLE_LENGTH}-character limit (${title.length} characters). Shorten the player name, deck name or event code.`;
  }
  if (title.length < MIN_TITLE_LENGTH) {
    return `The deck title must be at least ${MIN_TITLE_LENGTH} characters.`;
  }
  return null;
}
