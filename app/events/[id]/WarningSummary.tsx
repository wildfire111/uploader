import type { DecklistWarning } from "@/lib/decklist/types";
import type { Entry } from "@/lib/types";
import { countEntriesByProblem } from "./warningLabels";

// One line per kind of problem, shown only when some entry has it. Each line jumps to the next
// entry with that problem, after the open one and wrapping round to the first.
export function WarningSummary({
  entries,
  warningsByEntryId,
  selectedEntryId,
  locked,
  onSelect,
}: {
  entries: Entry[];
  warningsByEntryId: Map<string, DecklistWarning[]>;
  selectedEntryId: string | null;
  // an edit is open, so the open entry can't be left from here
  locked: boolean;
  onSelect: (entryId: string) => void;
}) {
  const rows = countEntriesByProblem(
    entries.map((e) => e.id),
    warningsByEntryId
  );

  function jumpTo(code: DecklistWarning["code"]) {
    const start = entries.findIndex((e) => e.id === selectedEntryId);
    for (let step = 1; step <= entries.length; step++) {
      const entry = entries[(start + step + entries.length) % entries.length];
      if (warningsByEntryId.get(entry.id)?.some((w) => w.code === code)) {
        onSelect(entry.id);
        return;
      }
    }
  }

  return (
    <>
      {rows.map(({ code, problem, count }) => (
        <p key={code} className="warning">
          <button
            type="button"
            className="warning-jump"
            disabled={locked}
            onClick={() => jumpTo(code)}
            title={locked ? "Save or cancel the open edit first" : undefined}
          >
            {count} {count === 1 ? "entry" : "entries"} with {problem}
            <span className="warning-jump-hint"> &mdash; go to next</span>
          </button>
        </p>
      ))}
    </>
  );
}
