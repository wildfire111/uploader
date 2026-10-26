"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { assignPlacingAction, unplaceEntryAction } from "@/lib/actions/entries";
import { formatPlacing } from "@/lib/placing";
import type { Entry } from "@/lib/types";
import { matchEntries } from "./entryFields";

const MAX_RECENT = 5;
// the list scrolls, so it can hold far more than fits on screen
const MAX_SHOWN = 100;

type Assigned = { entry: Entry; placeholder: number };

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function QuickAssign({
  entries,
  attendance,
  onChanged,
  onDone,
}: {
  entries: Entry[];
  attendance: number;
  onChanged: (entry: Entry) => void;
  onDone: () => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const placingRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [chosen, setChosen] = useState<Entry | null>(null);
  const [placingFrom, setPlacingFrom] = useState("");
  const [placingTo, setPlacingTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<Assigned[]>([]);

  const unplaced = entries.filter((entry) => !entry.placingAssigned);
  const placedCount = entries.length - unplaced.length;
  const matches = matchEntries(unplaced, query, MAX_SHOWN);

  function reset() {
    setQuery("");
    setHighlight(0);
    setChosen(null);
    setPlacingFrom("");
    setPlacingTo("");
    setError(null);
    nameRef.current?.focus();
  }

  function choose(entry: Entry) {
    setChosen(entry);
    setError(null);
    // wait for the placing box to render before focusing it
    setTimeout(() => placingRef.current?.focus(), 0);
  }

  function onNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = matches[highlight];
      if (entry) {
        choose(entry);
      }
    } else if (event.key === "Escape") {
      reset();
    }
  }

  async function save() {
    if (!chosen || saving) {
      return;
    }
    const from = Number(placingFrom);
    const to = placingTo === "" ? null : Number(placingTo);
    if (placingFrom === "" || from < 1) {
      setError("Enter a placing.");
      placingRef.current?.focus();
      return;
    }
    if (to !== null && to <= from) {
      setError("The 'to' placing has to be higher than the placing.");
      return;
    }

    setSaving(true);
    const placeholder = chosen.placingFrom;
    const result = await assignPlacingAction(chosen.id, from, to);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged(result.data);
    setRecent((current) => [{ entry: result.data, placeholder }, ...current].slice(0, MAX_RECENT));
    reset();
  }

  function onPlacingKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void save();
    } else if (event.key === "Escape") {
      reset();
    }
  }

  async function undo(assigned: Assigned) {
    const result = await unplaceEntryAction(assigned.entry.id, assigned.placeholder);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged(result.data);
    setRecent((current) => current.filter((item) => item.entry.id !== assigned.entry.id));
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-brand/40 bg-panel p-4"
      aria-label="Place lists"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0">Placing lists</h2>
        <button type="button" onClick={onDone}>
          Done
        </button>
      </div>
      <p className="text-sm text-muted">
        {placedCount} of {entries.length} placed. Type a player, press Enter to pick them, then
        type their placing and press Enter.
      </p>

      {unplaced.length > 0 ? (
        <>
          <label htmlFor="quick-assign-name">Player</label>
          <input
            id="quick-assign-name"
            ref={nameRef}
            type="text"
            autoComplete="off"
            autoFocus
            role="combobox"
            aria-expanded={!chosen}
            aria-controls="quick-assign-matches"
            placeholder="Start typing a player or deck name"
            value={chosen ? chosen.playerName : query}
            disabled={chosen !== null}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
            }}
            onKeyDown={onNameKeyDown}
          />

          {chosen ? (
            <>
              <p className="text-sm text-muted">{chosen.deckName}</p>
              <div className="button-row">
                <label htmlFor="quick-assign-from">Placing</label>
                <input
                  id="quick-assign-from"
                  ref={placingRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={placingFrom}
                  onChange={(event) => setPlacingFrom(digitsOnly(event.target.value))}
                  onKeyDown={onPlacingKeyDown}
                />
                <label htmlFor="quick-assign-to">to (optional)</label>
                <input
                  id="quick-assign-to"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={placingTo}
                  onChange={(event) => setPlacingTo(digitsOnly(event.target.value))}
                  onKeyDown={onPlacingKeyDown}
                />
                <button type="button" onClick={reset} disabled={saving}>
                  Cancel
                </button>
                <button type="button" data-variant="primary" onClick={save} disabled={saving}>
                  Place
                </button>
              </div>
            </>
          ) : (
            <div id="quick-assign-matches" role="listbox" className="entries-pane max-h-96">
              {matches.map((entry, index) => (
                <div
                  key={entry.id}
                  className="entry-row"
                  role="option"
                  aria-selected={index === highlight}
                  data-selected={index === highlight}
                  onClick={() => choose(entry)}
                >
                  <span className="text-muted">Unplaced</span>
                  <span className="min-w-0">
                    <span className="block truncate">{entry.playerName}</span>
                    <span className="block truncate text-sm text-muted">{entry.deckName}</span>
                  </span>
                </div>
              ))}
              {matches.length === 0 ? (
                <p className="p-3 text-sm text-muted">No unplaced list matches.</p>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <p>Every list is placed. Press Done to review them and submit.</p>
      )}

      {error ? <p className="error">{error}</p> : null}

      {recent.length > 0 ? (
        <ul className="text-sm">
          {recent.map((assigned) => (
            <li key={assigned.entry.id}>
              {formatPlacing(assigned.entry, attendance)} {assigned.entry.playerName}{" "}
              <button type="button" onClick={() => undo(assigned)}>
                Undo
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
