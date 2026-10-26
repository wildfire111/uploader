"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  deleteEventAction,
  reopenEventAction,
  returnToDraftAction,
  submitEventAction,
  unlockMetadataAction,
} from "@/lib/actions/events";
import type { AliasList, PointsList } from "@/lib/decklist/types";
import {
  areDetailsLocked,
  canDeleteEvent,
  canEditEntry,
  canEditEvent,
  canEditEventDetails,
  canPublishEvent,
  canReopenEvent,
  canReturnToDraft,
  canSubmitEvent,
  canUnlockMetadata,
} from "@/lib/permissions";
import { placingWarnings } from "@/lib/placing";
import type { AllowedUser, Entry, Event } from "@/lib/types";
import { EntriesList } from "./EntriesList";
import { EntryForm } from "./EntryForm";
import { sortEntries } from "./entryFields";
import { EventHeader } from "./EventHeader";
import { QuickAssign } from "./QuickAssign";
import { runAction } from "./runAction";
import { useDecklistChecks } from "./useDecklistChecks";
import { useEntryEditor } from "./useEntryEditor";
import { useEventDetails } from "./useEventDetails";
import { usePublish } from "./usePublish";
import { WarningSummary } from "./WarningSummary";

export function EventDetailClient({
  event: initialEvent,
  entries: initialEntries,
  currentUser,
  publishAccount,
  pointsList,
  reservedNames,
  cardNamesVersion,
  aliasList,
  companionNames,
}: {
  event: Event;
  entries: Entry[];
  currentUser: AllowedUser;
  publishAccount: string | null;
  // null until the points list has been loaded
  pointsList: PointsList | null;
  reservedNames: string[] | null;
  // when the stored card-name list was fetched; null until there is one
  cardNamesVersion: number | null;
  aliasList: AliasList | null;
  companionNames: string[] | null;
}) {
  const [event, setEvent] = useState<Event>(initialEvent);
  const [entries, setEntries] = useState<Entry[]>(() => sortEntries(initialEntries));
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  // the placing panel stands in for the list of entries while it's open
  const [placing, setPlacing] = useState(false);
  const unplacedCount = entries.filter((e) => !e.placingAssigned).length;

  const pageIsEditable = canEditEvent(currentUser, event);
  const details = useEventDetails({ event, setEvent, startTransition });
  const editor = useEntryEditor({
    eventId: event.id,
    entries,
    setEntries,
    pageIsEditable,
    detailsEditing: details.editing,
    startTransition,
  });
  const publishing = usePublish({ event, entries, setEvent, setEntries, startTransition });
  const { lists, warningsByEntryId } = useDecklistChecks({
    entries,
    pointsList,
    reservedNames,
    cardNamesVersion,
    aliasList,
    companionNames,
  });

  const detailPaneRef = useRef<HTMLDivElement>(null);
  const { scrollKey } = editor;
  useEffect(() => {
    detailPaneRef.current?.scrollTo(0, 0);
  }, [scrollKey]);

  function deleteEvent() {
    const hasPublishedEntries = entries.some((e) => e.moxfieldDeckId !== null);
    const message = hasPublishedEntries
      ? "Some or all of this event's decks are already on Moxfield. Deleting it here removes it from this tool only. The decks will stay on Moxfield and must be deleted there if needed.\n\nDelete this event?"
      : "Delete this event?";
    if (!window.confirm(message)) return;
    runAction(startTransition, setActionError, async () => {
      const result = await deleteEventAction(event.id);
      if (!result.ok) {
        setActionError(result.error);
      }
    });
  }

  function placingChanged(changed: Entry) {
    setEntries((current) => sortEntries(current.map((e) => (e.id === changed.id ? changed : e))));
  }

  function submitEvent() {
    // odd placings are worth a look, but they don't stop a submit
    const { duplicates, skipped } = placingWarnings(entries);
    const notes: string[] = [];
    if (duplicates.length > 0) {
      notes.push(`More than one list has the exact placing ${duplicates.join(", ")}.`);
    }
    if (skipped.length > 0) {
      notes.push(`No list has the placing ${skipped.join(", ")}.`);
    }
    if (notes.length > 0 && !window.confirm(`${notes.join("\n")}\n\nSubmit it anyway?`)) {
      return;
    }
    runAction(startTransition, setActionError, async () => {
      const result = await submitEventAction(event.id);
      if (!result.ok) {
        setActionError(result.error);
      }
    });
  }

  function reopenEvent() {
    runAction(startTransition, setActionError, async () => {
      const result = await reopenEventAction(event.id);
      if (result.ok) {
        setEvent(result.data);
      } else {
        setActionError(result.error);
      }
    });
  }

  function returnToDraft() {
    const message =
      "This hands the event back to the person who created it. You won't be able to see or edit it again until they resubmit it.\n\nReturn it to draft?";
    if (!window.confirm(message)) return;
    runAction(startTransition, setActionError, async () => {
      const result = await returnToDraftAction(event.id);
      if (!result.ok) {
        setActionError(result.error);
      }
    });
  }

  function unlockDetails() {
    const message =
      "Lists from this event are already on Moxfield with the details as they are now. Changing the details here won't change those lists, or the name of the Moxfield folder they're in. Anything wrong in a published list has to be fixed on Moxfield. The details lock again when you next publish.\n\nUnlock the details?";
    if (!window.confirm(message)) return;
    runAction(startTransition, setActionError, async () => {
      const result = await unlockMetadataAction(event.id);
      if (result.ok) {
        setEvent(result.data);
      } else {
        setActionError(result.error);
      }
    });
  }

  const { selection, editInProgress } = editor;
  const publishedCount = entries.filter((e) => e.moxfieldDeckId !== null).length;
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

      <EventHeader
        event={event}
        details={details}
        entryCount={entries.length}
        publishedCount={publishedCount}
        canEdit={canEditEventDetails(currentUser, event, entries)}
        canDelete={canDeleteEvent(currentUser, event)}
        canSubmit={canSubmitEvent(currentUser, event, entries) && !editInProgress}
        canPublish={canPublish}
        canReopen={canReopenEvent(currentUser, event)}
        canReturnToDraft={canReturnToDraft(currentUser, event)}
        canUnlock={canUnlockMetadata(currentUser, event, entries)}
        detailsLocked={pageIsEditable && areDetailsLocked(event, entries)}
        editInProgress={editInProgress}
        isPending={isPending}
        isPublishing={publishing.progress !== null}
        retryInSeconds={publishing.retryInSeconds}
        onDelete={deleteEvent}
        onSubmit={submitEvent}
        onPublish={publishing.publish}
        onReopen={reopenEvent}
        onReturnToDraft={returnToDraft}
        onUnlock={unlockDetails}
      />

      {canPublish && publishAccount ? (
        <p>
          Publishing to the Moxfield account <strong>{publishAccount}</strong>.
        </p>
      ) : null}
      {publishing.progress ? (
        <p>
          Publishing {publishing.progress.done} of {publishing.progress.total}&hellip;
        </p>
      ) : null}
      {publishing.error ? <p className="error">{publishing.error}</p> : null}
      {actionError ? <p className="error">{actionError}</p> : null}
      {attendanceWarning ? (
        <p className="warning">
          {entries.length} entries but attendance is {event.attendance}
        </p>
      ) : null}
      <WarningSummary warningsByEntryId={warningsByEntryId} />

      <div className="event-layout">
        <div className="entries-column">
          {pageIsEditable && unplacedCount > 0 && !placing ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-brand/40 bg-brand/10 px-3 py-2">
              <span>
                {unplacedCount} of {entries.length} lists still need a placing before this can be
                submitted.
              </span>
              <button
                type="button"
                data-variant="primary"
                onClick={() => setPlacing(true)}
                disabled={editInProgress}
              >
                Place lists
              </button>
            </div>
          ) : null}
          {placing ? (
            <QuickAssign
              entries={entries}
              attendance={event.attendance}
              onChanged={placingChanged}
              onDone={() => setPlacing(false)}
            />
          ) : (
            <>
              <EntriesList
                entries={entries}
                attendance={event.attendance}
                selectedEntryId={selection.type === "existing" ? selection.entryId : null}
                isNewEntryOpen={selection.type === "new"}
                locked={editInProgress}
                onSelect={editor.selectEntry}
                warningsByEntryId={warningsByEntryId}
              />
              {pageIsEditable && selection.type !== "new" ? (
                <div>
                  <button type="button" onClick={editor.openNewEntry} disabled={editInProgress}>
                    + Add entry
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="entry-detail-pane" ref={detailPaneRef}>
          {pageIsEditable && selection.type === "new" ? (
            <>
              <h2>New entry</h2>
              <EntryForm
                mode="new"
                fields={editor.fields}
                attendance={event.attendance}
                onFieldsChange={editor.setFields}
                onCancel={editor.cancelEdit}
                onSaveAndNext={() => editor.saveNew("next")}
                onSaveAndClose={() => editor.saveNew("close")}
                isPending={isPending}
                error={editor.error}
                focusPlayerToken={editor.focusPlayerToken}
                lists={lists}
              />
            </>
          ) : null}

          {selection.type === "existing" && selectedEntry ? (
            <>
              <h2>Entry</h2>
              <EntryForm
                mode={selectedEntryEditable ? "existing" : "readonly"}
                fields={editor.fields}
                attendance={event.attendance}
                onFieldsChange={editor.setFields}
                onCancel={editor.cancelEdit}
                onSave={editor.saveExisting}
                onDelete={selectedEntryEditable ? editor.deleteSelected : undefined}
                isPending={isPending}
                error={editor.error}
                lists={lists}
              />
            </>
          ) : null}

          {selection.type === "none" ? <p>No entries yet.</p> : null}
        </div>
      </div>
    </main>
  );
}
