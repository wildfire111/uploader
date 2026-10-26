"use client";

import { formatPlacing } from "@/lib/placing";
import type { DecklistWarning } from "@/lib/decklist/types";
import { CheckIcon, WarnIcon } from "./icons";
import { warningLabel } from "./warningLabels";
import type { Entry } from "@/lib/types";

export function EntriesList({
  entries,
  attendance,
  selectedEntryId,
  isNewEntryOpen,
  locked,
  onSelect,
  warningsByEntryId,
}: {
  entries: Entry[];
  attendance: number;
  selectedEntryId: string | null;
  isNewEntryOpen: boolean;
  locked: boolean;
  onSelect: (entryId: string) => void;
  warningsByEntryId: Map<string, DecklistWarning[]>;
}) {
  return (
    <div className="entries-pane">
      {entries.map((entry) => {
        const isSelected = entry.id === selectedEntryId;
        const isClickable = !locked || isSelected;
        const warnings = warningsByEntryId.get(entry.id) ?? [];
        const isPublished = entry.moxfieldDeckId !== null;
        return (
          <button
            key={entry.id}
            type="button"
            className="entry-row"
            data-selected={isSelected}
            data-published={isPublished}
            aria-current={isSelected ? "true" : undefined}
            disabled={!isClickable}
            onClick={() => onSelect(entry.id)}
          >
            <span className="entry-placing">
              {formatPlacing(entry, attendance)}
              {isPublished ? (
                <>
                  <CheckIcon />
                  <span className="sr-only">Published</span>
                </>
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{entry.playerName}</span>
              <span className="block truncate text-sm text-muted">{entry.deckName}</span>
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
      {entries.length === 0 && !isNewEntryOpen ? (
        <div className="entry-row" data-placeholder="true">
          <span></span>
          <span>No entries yet.</span>
        </div>
      ) : null}
    </div>
  );
}
