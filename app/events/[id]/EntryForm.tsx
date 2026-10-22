"use client";

import { useEffect, useRef, useState } from "react";
import { formatPlacing } from "@/lib/placing";
import type { CheckLists } from "@/lib/decklist/types";
import { MAX_DECK_NAME_LENGTH, MAX_DECKLIST_LENGTH, MAX_PLAYER_NAME_LENGTH } from "@/lib/validation";
import { DecklistChecks } from "./DecklistChecks";
import type { EntryFieldValues } from "./types";

type Mode = "new" | "existing" | "readonly";

export function EntryForm({
  mode,
  fields,
  attendance,
  onFieldsChange,
  onCancel,
  onSave,
  onSaveAndNext,
  onSaveAndClose,
  onDelete,
  isPending,
  error,
  focusPlayerToken,
  lists,
}: {
  mode: Mode;
  fields: EntryFieldValues;
  attendance: number;
  onFieldsChange: (fields: EntryFieldValues) => void;
  onCancel: () => void;
  onSave?: () => void;
  onSaveAndNext?: () => void;
  onSaveAndClose?: () => void;
  onDelete?: () => void;
  isPending: boolean;
  error: string | null;
  // bump to move focus back to Player after Save & next
  focusPlayerToken?: number;
  lists: CheckLists;
}) {
  const playerInputRef = useRef<HTMLInputElement>(null);
  const [decklistFocused, setDecklistFocused] = useState(false);

  useEffect(() => {
    if (focusPlayerToken) {
      playerInputRef.current?.focus();
    }
  }, [focusPlayerToken]);

  const canSubmit =
    fields.playerName.trim() !== "" &&
    fields.deckName.trim() !== "" &&
    fields.decklistRaw.trim() !== "";

  function updateField<K extends keyof EntryFieldValues>(key: K, value: EntryFieldValues[K]) {
    onFieldsChange({ ...fields, [key]: value });
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (mode === "new" && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (canSubmit && !isPending) {
        onSaveAndNext?.();
      }
    }
  }

  if (mode === "readonly") {
    return (
      <dl className="readonly-grid">
        <div className="readonly-field">
          <dt>Placing</dt>
          <dd>
            {formatPlacing(
              {
                placingFrom: Number(fields.placingFrom),
                placingTo: fields.placingTo ? Number(fields.placingTo) : null,
              },
              attendance
            )}
          </dd>
        </div>
        <div className="readonly-field">
          <dt>Player name</dt>
          <dd>{fields.playerName}</dd>
        </div>
        <div className="readonly-field">
          <dt>Deck name</dt>
          <dd>{fields.deckName}</dd>
        </div>
        <div className="readonly-field">
          <dt>Decklist</dt>
          <dd className="decklist-readonly">{fields.decklistRaw}</dd>
        </div>
        <div className="readonly-field lg:col-start-1">
          <DecklistChecks decklistRaw={fields.decklistRaw} lists={lists} />
        </div>
      </dl>
    );
  }

  return (
    <div className="entry-form-root" onKeyDown={handleKeyDown}>
      {error ? <p className="error">{error}</p> : null}

      <form
        className="entry-form"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="entry-form-fields">
          <div className="field-row">
            <label>
              Placing (from)
              <input
                type="number"
                min={1}
                step={1}
                value={fields.placingFrom}
                onChange={(event) => updateField("placingFrom", event.target.value)}
              />
            </label>
            <label>
              Placing (to) — optional
              <input
                type="number"
                placeholder="Only for a shared range"
                min={1}
                step={1}
                value={fields.placingTo}
                onChange={(event) => updateField("placingTo", event.target.value)}
              />
            </label>
          </div>

          <label>
            Player name
            <input
              type="text"
              maxLength={MAX_PLAYER_NAME_LENGTH}
              value={fields.playerName}
              onChange={(event) => updateField("playerName", event.target.value)}
              ref={playerInputRef}
              autoFocus={mode === "new"}
            />
          </label>

          <label>
            Deck name
            <input
              type="text"
              maxLength={MAX_DECK_NAME_LENGTH}
              value={fields.deckName}
              onChange={(event) => updateField("deckName", event.target.value)}
            />
          </label>

          <DecklistChecks
            decklistRaw={fields.decklistRaw}
            lists={lists}
            typing={decklistFocused}
            onChange={(decklistRaw) => updateField("decklistRaw", decklistRaw)}
          />
        </div>

        <label className="entry-form-decklist">
          Decklist
          <textarea
            rows={12}
            maxLength={MAX_DECKLIST_LENGTH}
            value={fields.decklistRaw}
            onChange={(event) => updateField("decklistRaw", event.target.value)}
            onFocus={() => setDecklistFocused(true)}
            onBlur={() => setDecklistFocused(false)}
          />
        </label>

        <div className="form-actions entry-form-actions">
          <div>
            {mode === "existing" && onDelete ? (
              <button type="button" data-variant="danger" onClick={onDelete} disabled={isPending}>
                Delete entry
              </button>
            ) : null}
          </div>
          <div className="button-row">
            <button type="button" onClick={onCancel} disabled={isPending}>
              Cancel
            </button>
            {mode === "new" ? (
              <>
                <button
                  type="button"
                  onClick={onSaveAndClose}
                  disabled={!canSubmit || isPending}
                >
                  Save &amp; close
                </button>
                <button
                  type="button"
                  data-variant="primary"
                  onClick={onSaveAndNext}
                  disabled={!canSubmit || isPending}
                >
                  Save &amp; next
                </button>
              </>
            ) : (
              <button
                type="button"
                data-variant="primary"
                onClick={onSave}
                disabled={!canSubmit || isPending}
              >
                Save
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
