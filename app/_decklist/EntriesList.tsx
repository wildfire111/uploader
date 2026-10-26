"use client";

import type { DecklistWarning } from "@/lib/decklist/types";

const WARNING_LABELS: Record<DecklistWarning["code"], string> = {
  points: "points",
  "deck-size": "deck size",
  "unknown-card": "card name",
  singleton: "duplicates",
  companion: "companion",
};

function warningLabel(warnings: DecklistWarning[]): string {
  return [...new Set(warnings.map((warning) => WARNING_LABELS[warning.code]))].join(", ");
}

// what a row shows; the event page and the standalone checker each build these from their own lists
export type EntryRow = {
  id: string;
  // the left column: a placing, or a position in the file
  label: string;
  playerName: string;
  deckName: string;
  published?: boolean;
};

export function EntriesList({
  rows,
  selectedId,
  isNewEntryOpen = false,
  locked = false,
  onSelect,
  warningsByEntryId,
  emptyText = "No entries yet.",
}: {
  rows: EntryRow[];
  selectedId: string | null;
  isNewEntryOpen?: boolean;
  locked?: boolean;
  onSelect: (entryId: string) => void;
  warningsByEntryId: Map<string, DecklistWarning[]>;
  emptyText?: string;
}) {
  return (
    <div className="entries-pane">
      {rows.map((row) => {
        const isSelected = row.id === selectedId;
        const isClickable = !locked || isSelected;
        const warnings = warningsByEntryId.get(row.id);
        return (
          <div
            key={row.id}
            className="entry-row"
            data-selected={isSelected}
            data-published={row.published === true}
            role="button"
            tabIndex={isClickable ? 0 : -1}
            aria-disabled={!isClickable}
            style={isClickable ? undefined : { cursor: "default", opacity: 0.6 }}
            onClick={() => {
              if (isClickable) {
                onSelect(row.id);
              }
            }}
          >
            <span>
              {row.label}
              {row.published ? " ✓" : ""}
            </span>
            <span className="min-w-0">
              <span className="block truncate">{row.playerName}</span>
              <span className="block truncate text-sm text-muted">{row.deckName}</span>
              {warnings?.length ? (
                <span
                  className="block truncate text-sm text-warn"
                  title={warnings.map((warning) => warning.message).join("\n")}
                >
                  &#9888; {warningLabel(warnings)}
                </span>
              ) : null}
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
      {rows.length === 0 && !isNewEntryOpen ? (
        <div className="entry-row" data-placeholder="true">
          <span></span>
          <span>{emptyText}</span>
        </div>
      ) : null}
    </div>
  );
}
