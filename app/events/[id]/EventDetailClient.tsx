"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  createEntryAction,
  deleteEntryAction,
  updateEntryAction,
} from "@/lib/actions/entries";
import {
  deleteEventAction,
  submitEventAction,
  updateEventDetailsAction,
} from "@/lib/actions/events";
import { formatDisplayDate } from "@/lib/formatDate";
import {
  canDeleteEvent,
  canEditEntry,
  canEditEvent,
  canPublishEvent,
  canSubmitEvent,
} from "@/lib/permissions";
import { suggestNextPlacing } from "@/lib/placing";
import { getStatusLabel } from "@/lib/statusLabel";
import type { AllowedUser, Entry, Event } from "@/lib/types";
import {
  MAX_ATTENDANCE,
  MAX_EVENT_FULL_NAME_LENGTH,
  MAX_EVENT_NAME_LENGTH,
  MAX_EVENT_YEAR,
  MIN_EVENT_YEAR,
  validateEventDetails,
} from "@/lib/validation";
import { EntriesList } from "./EntriesList";
import { EntryForm } from "./EntryForm";
import { blankEntryFields, type EntryFieldValues } from "./types";

const UNEXPECTED_ERROR = "Something went wrong. Please try again.";

type Selection = { type: "none" } | { type: "new" } | { type: "existing"; entryId: string };

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) => a.placingFrom - b.placingFrom || a.createdAt.localeCompare(b.createdAt)
  );
}

function entryToFields(entry: Entry): EntryFieldValues {
  return {
    placingFrom: String(entry.placingFrom),
    placingTo: entry.placingTo === null ? "" : String(entry.placingTo),
    playerName: entry.playerName,
    deckName: entry.deckName,
    decklistRaw: entry.decklistRaw,
  };
}

function suggestedPlacingFields(entries: Entry[]): Pick<EntryFieldValues, "placingFrom" | "placingTo"> {
  const suggestion = suggestNextPlacing(entries);
  return {
    placingFrom: String(suggestion.placingFrom),
    placingTo: suggestion.placingTo === null ? "" : String(suggestion.placingTo),
  };
}

function pickDefaultSelection(entries: Entry[], canEdit: boolean): Selection {
  if (entries.length > 0) {
    return { type: "existing", entryId: entries[0].id };
  }
  if (canEdit) {
    return { type: "new" };
  }
  return { type: "none" };
}

export function EventDetailClient({
  event: initialEvent,
  entries: initialEntries,
  currentUser,
  publishAccount,
}: {
  event: Event;
  entries: Entry[];
  currentUser: AllowedUser;
  publishAccount: string | null;
}) {
  const [event, setEvent] = useState<Event>(initialEvent);
  const [entries, setEntries] = useState<Entry[]>(() => sortEntries(initialEntries));
  const pageIsEditable = canEditEvent(currentUser, event);

  const [selection, setSelection] = useState<Selection>(() =>
    pickDefaultSelection(initialEntries, pageIsEditable)
  );
  const [fields, setFields] = useState<EntryFieldValues>(() => {
    if (selection.type === "new") {
      return { ...blankEntryFields(), ...suggestedPlacingFields(initialEntries) };
    }
    if (selection.type === "existing") {
      const entry = initialEntries.find((e) => e.id === selection.entryId);
      if (entry) return entryToFields(entry);
    }
    return blankEntryFields();
  });
  const [savedFields, setSavedFields] = useState<EntryFieldValues | null>(() => {
    if (selection.type === "existing") {
      const entry = initialEntries.find((e) => e.id === selection.entryId);
      if (entry) return entryToFields(entry);
    }
    return null;
  });

  const [detailsEditing, setDetailsEditing] = useState(false);
  const [detailsFields, setDetailsFields] = useState({
    name: event.name,
    fullName: event.fullName,
    date: event.date,
    attendance: String(event.attendance),
  });

  const [entryError, setEntryError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [publishProgress, setPublishProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [publishError, setPublishError] = useState<string | null>(null);
  const [focusPlayerToken, setFocusPlayerToken] = useState(0);

  // reset the pane's scroll when the entry changes
  const detailPaneRef = useRef<HTMLDivElement>(null);
  const selectedKey = selection.type === "existing" ? selection.entryId : selection.type;
  useEffect(() => {
    detailPaneRef.current?.scrollTo(0, 0);
  }, [selectedKey, focusPlayerToken]);
  const [isPending, startTransition] = useTransition();

  const isDirty =
    selection.type === "new" ||
    (selection.type === "existing" &&
      savedFields !== null &&
      JSON.stringify(fields) !== JSON.stringify(savedFields));
  const editInProgress = isDirty || detailsEditing;

  function applySelection(next: Selection) {
    setSelection(next);
    if (next.type === "existing") {
      const entry = entries.find((e) => e.id === next.entryId);
      if (entry) {
        setFields(entryToFields(entry));
        setSavedFields(entryToFields(entry));
        return;
      }
    }
    if (next.type === "new") {
      setFields({ ...blankEntryFields(), ...suggestedPlacingFields(entries) });
      setSavedFields(null);
      return;
    }
    setFields(blankEntryFields());
    setSavedFields(null);
  }

  function selectEntry(entryId: string) {
    if (editInProgress) return;
    applySelection({ type: "existing", entryId });
    setEntryError(null);
  }

  function openNewEntry() {
    if (editInProgress || !pageIsEditable) return;
    applySelection({ type: "new" });
    setEntryError(null);
  }

  function cancelEntryEdit() {
    if (selection.type === "existing" && savedFields) {
      setFields(savedFields);
      setEntryError(null);
      return;
    }
    applySelection(pickDefaultSelection(entries, pageIsEditable));
    setEntryError(null);
  }

  function parseEntryInput() {
    return {
      placingFrom: Number(fields.placingFrom),
      placingTo: fields.placingTo.trim() === "" ? null : Number(fields.placingTo),
      playerName: fields.playerName.trim(),
      deckName: fields.deckName.trim(),
      decklistRaw: fields.decklistRaw,
    };
  }

  function saveNewEntry(andThen: "next" | "close") {
    setEntryError(null);
    startTransition(async () => {
      try {
        const result = await createEntryAction(event.id, parseEntryInput());
        if (!result.ok) {
          setEntryError(result.error);
          return;
        }
        const updatedEntries = sortEntries([...entries, result.data]);
        setEntries(updatedEntries);
        if (andThen === "next") {
          setFields({ ...blankEntryFields(), ...suggestedPlacingFields(updatedEntries) });
          setSavedFields(null);
          setFocusPlayerToken((token) => token + 1);
        } else {
          applySelection(pickDefaultSelection(updatedEntries, pageIsEditable));
        }
      } catch {
        setEntryError(UNEXPECTED_ERROR);
      }
    });
  }

  function saveExistingEntry() {
    if (selection.type !== "existing") return;
    const entryId = selection.entryId;
    setEntryError(null);
    startTransition(async () => {
      try {
        const result = await updateEntryAction(entryId, parseEntryInput());
        if (!result.ok) {
          setEntryError(result.error);
          return;
        }
        const updated = result.data;
        const updatedEntries = sortEntries(
          entries.map((e) => (e.id === entryId ? updated : e))
        );
        setEntries(updatedEntries);
        setFields(entryToFields(updated));
        setSavedFields(entryToFields(updated));
      } catch {
        setEntryError(UNEXPECTED_ERROR);
      }
    });
  }

  function deleteSelectedEntry() {
    if (selection.type !== "existing") return;
    const entryId = selection.entryId;
    setEntryError(null);
    startTransition(async () => {
      try {
        const result = await deleteEntryAction(entryId);
        if (!result.ok) {
          setEntryError(result.error);
          return;
        }
        const updatedEntries = entries.filter((e) => e.id !== entryId);
        setEntries(updatedEntries);
        applySelection(pickDefaultSelection(updatedEntries, pageIsEditable));
      } catch {
        setEntryError(UNEXPECTED_ERROR);
      }
    });
  }

  function saveEventDetails() {
    setDetailsError(null);
    const attendance = Number(detailsFields.attendance);
    const problem = validateEventDetails({
      name: detailsFields.name,
      fullName: detailsFields.fullName,
      date: detailsFields.date,
      attendance,
    });
    if (problem) {
      setDetailsError(problem);
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateEventDetailsAction(event.id, {
          name: detailsFields.name.trim(),
          fullName: detailsFields.fullName.trim(),
          date: detailsFields.date,
          attendance,
        });
        if (!result.ok) {
          setDetailsError(result.error);
          return;
        }
        setEvent(result.data);
        setDetailsEditing(false);
      } catch {
        setDetailsError(UNEXPECTED_ERROR);
      }
    });
  }

  function cancelEventDetails() {
    setDetailsFields({
      name: event.name,
      fullName: event.fullName,
      date: event.date,
      attendance: String(event.attendance),
    });
    setDetailsEditing(false);
    setDetailsError(null);
  }

  function handleDeleteEvent() {
    const hasPublishedEntries = entries.some((e) => e.moxfieldDeckId !== null);
    const message = hasPublishedEntries
      ? "Some or all of this event's decks are already on Moxfield. Deleting it here removes it from this tool only. The decks will stay on Moxfield and must be deleted there if needed.\n\nDelete this event?"
      : "Delete this event?";
    if (!window.confirm(message)) return;
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await deleteEventAction(event.id);
        if (!result.ok) {
          setActionError(result.error);
        }
      } catch {
        setActionError(UNEXPECTED_ERROR);
      }
    });
  }

  function handleSubmitEvent() {
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await submitEventAction(event.id);
        if (!result.ok) {
          setActionError(result.error);
        }
      } catch {
        setActionError(UNEXPECTED_ERROR);
      }
    });
  }

  async function publishEntryOnServer(entryId: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`/api/entries/${entryId}/publish`, { method: "POST" });
    } catch {
      throw new Error(
        "The publish request failed to reach the server. Check Moxfield for a duplicate of this deck before retrying."
      );
    }

    if (response.status === 502) {
      const body = await response.json().catch(() => null);
      const message = body?.error ?? "Moxfield publish failed.";
      throw new Error(`${message} Check Moxfield for a duplicate of this deck before retrying.`);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? "Could not publish this entry.");
    }

    const body = (await response.json()) as { moxfieldDeckId: string };
    return body.moxfieldDeckId;
  }

  function handlePublish() {
    setPublishError(null);
    // one at a time, in placing order
    const unpublished = entries.filter((entry) => entry.moxfieldDeckId === null);
    const total = entries.length;
    let done = total - unpublished.length;
    setPublishProgress({ done, total });

    startTransition(async () => {
      try {
        for (const entry of unpublished) {
          const moxfieldDeckId = await publishEntryOnServer(entry.id);
          done += 1;
          setPublishProgress({ done, total });
          setEntries((prev) =>
            prev.map((e) => (e.id === entry.id ? { ...e, moxfieldDeckId } : e))
          );
        }

        const completeResponse = await fetch(`/api/events/${event.id}/publish-complete`, {
          method: "POST",
        });
        if (!completeResponse.ok) {
          const body = await completeResponse.json().catch(() => null);
          throw new Error(body?.error ?? "Could not finish publishing.");
        }
        const body = (await completeResponse.json()) as { event: Event };
        setEvent(body.event);
        setPublishProgress(null);
      } catch (error) {
        setPublishError(error instanceof Error ? error.message : "Publishing failed.");
        setPublishProgress(null);
      }
    });
  }

  const canDelete = canDeleteEvent(currentUser, event);
  const canSubmit = canSubmitEvent(currentUser, event, entries) && !editInProgress;
  const canPublish = canPublishEvent(currentUser, event, entries) && !editInProgress;
  const attendanceWarning = entries.length > event.attendance;

  const selectedEntry =
    selection.type === "existing" ? (entries.find((e) => e.id === selection.entryId) ?? null) : null;
  const selectedEntryEditable = selectedEntry
    ? canEditEntry(currentUser, event, selectedEntry)
    : false;

  return (
    <main className="event-page">
      <p>
        <Link href="/">&larr; Events</Link>
      </p>

      <div className="page-header">
        <div>
          {detailsEditing ? (
            <div>
              {detailsError ? <p className="error">{detailsError}</p> : null}
              <div className="field-row">
                <label>
                  Event code
                  <input
                    type="text"
                    maxLength={MAX_EVENT_NAME_LENGTH}
                    value={detailsFields.name}
                    onChange={(e) => setDetailsFields({ ...detailsFields, name: e.target.value })}
                  />
                </label>
                <label>
                  Full event name
                  <input
                    type="text"
                    maxLength={MAX_EVENT_FULL_NAME_LENGTH}
                    value={detailsFields.fullName}
                    onChange={(e) =>
                      setDetailsFields({ ...detailsFields, fullName: e.target.value })
                    }
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    min={`${MIN_EVENT_YEAR}-01-01`}
                    max={`${MAX_EVENT_YEAR}-12-31`}
                    value={detailsFields.date}
                    onChange={(e) => setDetailsFields({ ...detailsFields, date: e.target.value })}
                  />
                </label>
                <label>
                  Attendance
                  <input
                    type="number"
                    min={1}
                    max={MAX_ATTENDANCE}
                    step={1}
                    value={detailsFields.attendance}
                    onChange={(e) =>
                      setDetailsFields({ ...detailsFields, attendance: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="button-row mt-3">
                <button type="button" onClick={cancelEventDetails} disabled={isPending}>
                  Cancel
                </button>
                <button
                  type="button"
                  data-variant="primary"
                  onClick={saveEventDetails}
                  disabled={isPending}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <h1>
              {event.name} &middot; {formatDisplayDate(event.date)} &middot; {event.attendance}{" "}
              players &middot; {getStatusLabel(event.status)}
            </h1>
          )}
        </div>

        {!detailsEditing ? (
          <div className="button-row">
            {pageIsEditable ? (
              <button
                type="button"
                onClick={() => setDetailsEditing(true)}
                disabled={editInProgress}
              >
                Edit details
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                data-variant="danger"
                onClick={handleDeleteEvent}
                disabled={isPending}
              >
                Delete
              </button>
            ) : null}
            {canSubmit ? (
              <button
                type="button"
                data-variant="primary"
                onClick={handleSubmitEvent}
                disabled={isPending}
              >
                Submit for review
              </button>
            ) : null}
            {canPublish ? (
              <button
                type="button"
                data-variant="primary"
                onClick={handlePublish}
                disabled={publishProgress !== null}
              >
                Publish to Moxfield
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {canPublish && publishAccount ? (
        <p>
          Publishing to the Moxfield account <strong>{publishAccount}</strong>.
        </p>
      ) : null}
      {publishProgress ? (
        <p>
          Publishing {publishProgress.done} of {publishProgress.total}&hellip;
        </p>
      ) : null}
      {publishError ? <p className="error">{publishError}</p> : null}
      {actionError ? <p className="error">{actionError}</p> : null}
      {attendanceWarning ? (
        <p className="warning">
          {entries.length} entries but attendance is {event.attendance}
        </p>
      ) : null}

      <div className="event-layout">
        <EntriesList
          entries={entries}
          selectedEntryId={selection.type === "existing" ? selection.entryId : null}
          isNewEntryOpen={selection.type === "new"}
          locked={editInProgress}
          onSelect={selectEntry}
        />

        <div className="entry-detail-pane" ref={detailPaneRef}>
          {pageIsEditable && selection.type === "new" ? (
            <>
              <h2>New entry</h2>
              <EntryForm
                mode="new"
                fields={fields}
                onFieldsChange={setFields}
                onCancel={cancelEntryEdit}
                onSaveAndNext={() => saveNewEntry("next")}
                onSaveAndClose={() => saveNewEntry("close")}
                isPending={isPending}
                error={entryError}
                focusPlayerToken={focusPlayerToken}
              />
            </>
          ) : null}

          {selection.type === "existing" && selectedEntry ? (
            <>
              <h2>Entry</h2>
              <EntryForm
                mode={selectedEntryEditable ? "existing" : "readonly"}
                fields={fields}
                onFieldsChange={setFields}
                onCancel={cancelEntryEdit}
                onSave={saveExistingEntry}
                onDelete={selectedEntryEditable ? deleteSelectedEntry : undefined}
                isPending={isPending}
                error={entryError}
              />
            </>
          ) : null}

          {selection.type === "none" ? <p>No entries yet.</p> : null}
        </div>
      </div>

      {pageIsEditable && selection.type !== "new" ? (
        <p>
          <button type="button" onClick={openNewEntry} disabled={editInProgress}>
            + Add entry
          </button>
        </p>
      ) : null}
    </main>
  );
}
