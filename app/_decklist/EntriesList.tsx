"use client";

import type { DecklistWarning } from "@/lib/decklist/types";
import { CheckIcon, WarnIcon } from "./icons";
import { warningLabel } from "./warningLabels";

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
  compact = false,
  onSelect,
  warningsByEntryId,
  emptyText = "No entries yet.",
}: {
  rows: EntryRow[];
  selectedId: string | null;
  isNewEntryOpen?: boolean;
  locked?: boolean;
  // a narrow left column, for labels that are just a number
  compact?: boolean;
  onSelect: (entryId: string) => void;
  warningsByEntryId: Map<string, DecklistWarning[]>;
  emptyText?: string;
}) {
  return (
    <div className="entries-pane" data-compact={compact}>
      {rows.map((row) => {
        const isSelected = row.id === selectedId;
        const isClickable = !locked || isSelected;
        const warnings = warningsByEntryId.get(row.id) ?? [];
        return (
          <button
            key={row.id}
            type="button"
            className="entry-row"
            data-selected={isSelected}
            data-published={row.published === true}
            aria-current={isSelected ? "true" : undefined}
            disabled={!isClickable}
            onClick={() => onSelect(row.id)}
          >
            <span className="entry-placing">
              {row.label}
              {row.published ? (
                <>
                  <CheckIcon />
                  <span className="sr-only">Published</span>
                </>
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{row.playerName}</span>
              <span className="block truncate text-sm text-muted">{row.deckName}</span>
              {warnings.length ? (
                <span
                  className="entry-warning block truncate text-sm text-warn"
                  title={warnings.map((warning) => warning.message).join("\n")}
                >
                  <WarnIcon />
                  <span className="sr-only">Warnings: </span>
                  {warningLabel(warnings)}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
      {isNewEntryOpen ? (
        <div className="entry-row" data-selected="true" data-placeholder="true">
          <span className="entry-placing" aria-hidden="true">&hellip;</span>
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
