"use client";

import type { CheckLists } from "@/lib/decklist/types";
import { DecklistChecks } from "./DecklistChecks";
import { DecklistView } from "./DecklistView";

// One list as the reviewer sees it: who, what, and the decklist shaded with its checks. Used for a
// submitted event and for the standalone checker, which has no placing to show.
export function ReadonlyEntry({
  placing,
  playerName,
  deckName,
  decklistRaw,
  lists,
}: {
  placing?: string;
  playerName: string;
  deckName: string;
  decklistRaw: string;
  lists: CheckLists;
}) {
  return (
    <dl className="readonly-grid">
      {placing !== undefined ? (
        <div className="readonly-field">
          <dt>Placing</dt>
          <dd>{placing}</dd>
        </div>
      ) : null}
      <div className="readonly-field">
        <dt>Player name</dt>
        <dd>{playerName}</dd>
      </div>
      <div className="readonly-field">
        <dt>Deck name</dt>
        <dd>{deckName}</dd>
      </div>
      <div className="readonly-field readonly-decklist-field">
        <dt>Decklist</dt>
        <dd className="decklist-readonly">
          <DecklistView raw={decklistRaw} lists={lists} />
        </dd>
      </div>
      <div className="readonly-field lg:col-start-1">
        <DecklistChecks decklistRaw={decklistRaw} lists={lists} />
      </div>
    </dl>
  );
}
