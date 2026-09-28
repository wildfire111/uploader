"use client";

import { formatPlacing } from "@/lib/placing";
import type { Entry } from "@/lib/types";

export function EntriesList({
  entries,
  selectedEntryId,
  isNewEntryOpen,
  locked,
  onSelect,
}: {
  entries: Entry[];
  selectedEntryId: string | null;
  isNewEntryOpen: boolean;
  locked: boolean;
  onSelect: (entryId: string) => void;
}) {
  return (
    <div className="entries-pane">
      {entries.map((entry) => {
        const isSelected = entry.id === selectedEntryId;
        const isClickable = !locked || isSelected;
        return (
          <div
            key={entry.id}
            className="entry-row"
            data-selected={isSelected}
            data-published={entry.moxfieldDeckId !== null}
            role="button"
            tabIndex={isClickable ? 0 : -1}
            aria-disabled={!isClickable}
            style={isClickable ? undefined : { cursor: "default", opacity: 0.6 }}
            onClick={() => {
              if (isClickable) {
                onSelect(entry.id);
              }
            }}
          >
            <span>
              {formatPlacing(entry)}
              {entry.moxfieldDeckId !== null ? " ✓" : ""}
            </span>
            <span className="min-w-0">
              <span className="block truncate">{entry.playerName}</span>
              <span className="block truncate text-sm text-muted">{entry.deckName}</span>
            </span>
          </div>
        );
      })}
      {isNewEntryOpen ? (
        <div className="entry-row" data-selected="true" data-placeholder="true">
          <span>&#x25B8;</span>
          <span>(new entry)</span>
        </div>
      ) : null}
      {entries.length === 0 && !isNewEntryOpen ? (
        <div className="entry-row" data-placeholder="true">
          <span></span>
          <span>No entries yet.</span>
        </div>
      ) : null}
    </div>
  );
}
