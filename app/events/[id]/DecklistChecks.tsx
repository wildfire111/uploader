"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { analyseDecklist } from "@/lib/decklist/analyse";
import { checkDecklist } from "@/lib/decklist/rules";
import type { CheckLists } from "@/lib/decklist/types";

// how long the last line has to sit untouched before it counts as finished
const LAST_LINE_IDLE_MS = 1500;

// deferred so typing or pasting a long list is never held up by the check
export function DecklistChecks({
  decklistRaw,
  lists,
  typing = false,
}: {
  decklistRaw: string;
  lists: CheckLists;
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
  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        Maindeck {analysis.mainCount} &middot; Sideboard {analysis.sideCount}
        {analysis.total !== null ? (
          <>
            {" "}
            &middot; Points {analysis.total}
            {analysis.totalWithoutLurrus !== null
              ? ` (${analysis.totalWithoutLurrus} without Lurrus as a companion)`
              : ""}
          </>
        ) : null}
      </p>
      {warnings.map((warning) => (
        <p key={warning.message} className="warning">
          {warning.message}
        </p>
      ))}
    </div>
  );
}
