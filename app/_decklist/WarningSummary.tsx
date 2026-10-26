import type { DecklistWarning } from "@/lib/decklist/types";
import type { Entry } from "@/lib/types";

// One bar for every entry with a problem, shown only when there is one and no edit is open. It jumps to the next such
// entry after the open one, wrapping round to the first.
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
  // an edit is open: the bar is hidden, since the open entry can't be left from here
  locked: boolean;
  onSelect: (entryId: string) => void;
}) {
  const flagged = entries.filter((e) => warningsByEntryId.get(e.id)?.length);
  if (locked || flagged.length === 0) {
    return null;
  }

  function jumpToNext() {
    const start = entries.findIndex((e) => e.id === selectedEntryId);
    for (let step = 1; step <= entries.length; step++) {
      const entry = entries[(start + step + entries.length) % entries.length];
      if (warningsByEntryId.get(entry.id)?.length) {
        onSelect(entry.id);
        return;
      }
    }
  }

  return (
    <p className="warning">
      <button
        type="button"
        className="warning-jump"
        onClick={jumpToNext}
      >
        {flagged.length} {flagged.length === 1 ? "entry" : "entries"} with errors
        <span className="warning-jump-hint"> &mdash; go to next</span>
      </button>
    </p>
  );
}
