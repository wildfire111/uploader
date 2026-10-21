"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { analyseDecklist, cardNameCheck } from "@/lib/decklist/analyse";
import { setCompanion } from "@/lib/decklist/companion";
import { normaliseCardName } from "@/lib/decklist/normalise";
import { checkDecklist } from "@/lib/decklist/rules";
import type { CheckLists } from "@/lib/decklist/types";

// how long the last line has to sit untouched before it counts as finished
const LAST_LINE_IDLE_MS = 1500;

// deferred so typing or pasting a long list is never held up by the check
export function DecklistChecks({
  decklistRaw,
  lists,
  typing = false,
  onChange,
}: {
  decklistRaw: string;
  lists: CheckLists;
  // present when the decklist can be edited, which is what lets the companion be picked here
  onChange?: (decklistRaw: string) => void;
  // the decklist box has focus, so the last line may be half typed
  typing?: boolean;
}) {
  const deferred = useDeferredValue(decklistRaw);

  // a half-typed name ("Lightning Bo") shouldn't flag, so while the user is typing the last line
  // only counts once they start a new line, pause, or leave the box
  const [idleText, setIdleText] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setIdleText(deferred), LAST_LINE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [deferred]);
  const lastLineFinished = !typing || /\n\s*$/.test(deferred) || idleText === deferred;

  const result = useMemo(() => {
    if (deferred.trim() === "") {
      return null;
    }
    const analysis = analyseDecklist(deferred, lists);
    let unknownCards = analysis.unknownCards;
    if (!lastLineFinished && unknownCards.length > 0) {
      const finishedLines = deferred.slice(0, deferred.lastIndexOf("\n") + 1);
      unknownCards = analyseDecklist(finishedLines, lists).unknownCards;
    }
    return { analysis, warnings: checkDecklist({ ...analysis, unknownCards }), unknownCards };
  }, [deferred, lists, lastLineFinished]);

  if (!result) {
    return null;
  }
  const { analysis, warnings } = result;
  const pickCompanion = (name: string | null) => onChange?.(setCompanion(decklistRaw, name, cardNameCheck(lists)));
  // the sideboard cards that can be the companion, plus the one chosen even if it can't
  const companionChoices = onChange
    ? analysis.cards.filter(
        (card) =>
          card.board === "side" &&
          (card.companion || lists.companions?.has(normaliseCardName(card.name)))
      )
    : [];
  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        Maindeck {analysis.mainCount} &middot; Sideboard {analysis.sideCount}
        {analysis.total !== null ? (
          <>
            {" "}
            &middot; Points {analysis.total}
          </>
        ) : null}
      </p>
      {companionChoices.length > 0 ? (
        <div className="mb-2 text-sm">
          {companionChoices.map((card) => (
            <label key={card.name} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={card.companion === true}
                onChange={(event) => pickCompanion(event.target.checked ? card.name : null)}
              />
              Companion: {card.name}
            </label>
          ))}
        </div>
      ) : null}
      {warnings.map((warning) => (
        <p key={warning.message} className="warning">
          {warning.message}
          {onChange && warning.suggestCompanion ? (
            <>
              {" "}
              <button type="button" onClick={() => pickCompanion(warning.suggestCompanion ?? null)}>
                Mark as companion
              </button>
            </>
          ) : null}
        </p>
      ))}
    </div>
  );
}
