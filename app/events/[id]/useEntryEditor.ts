"use client";

import { useState, type Dispatch, type SetStateAction, type TransitionStartFunction } from "react";
import { createEntryAction, deleteEntryAction, updateEntryAction } from "@/lib/actions/entries";
import type { Entry } from "@/lib/types";
import {
  entryToFields,
  fieldsEqual,
  fieldsToInput,
  newEntryFields,
  pickDefaultSelection,
  sortEntries,
  type Selection,
} from "./entryFields";
import { runAction } from "./runAction";
import { blankEntryFields, type EntryFieldValues } from "./types";

// Which entry is open, what is typed into it, and saving, deleting and cancelling.
export function useEntryEditor({
  eventId,
  entries,
  setEntries,
  pageIsEditable,
  detailsEditing,
  startTransition,
}: {
  eventId: string;
  entries: Entry[];
  setEntries: Dispatch<SetStateAction<Entry[]>>;
  pageIsEditable: boolean;
  // the event's own details are being edited, which also locks the entry list
  detailsEditing: boolean;
  startTransition: TransitionStartFunction;
}) {
  const [selection, setSelection] = useState<Selection>(() =>
    pickDefaultSelection(entries, pageIsEditable)
  );
  const [fields, setFields] = useState<EntryFieldValues>(() => initialFields(selection, entries));
  // what the open entry looked like when it was loaded or last saved; null when there isn't one
  const [savedFields, setSavedFields] = useState<EntryFieldValues | null>(() =>
    selection.type === "existing" ? initialFields(selection, entries) : null
  );
  const [error, setError] = useState<string | null>(null);
  // bump to move focus back to Player after Save & next
  const [focusPlayerToken, setFocusPlayerToken] = useState(0);

  // changes whenever the pane should scroll back to the top: a different entry, or Save & next
  const scrollKey = `${selection.type === "existing" ? selection.entryId : selection.type}:${focusPlayerToken}`;

  const isDirty =
    selection.type === "new" ||
    (selection.type === "existing" && savedFields !== null && !fieldsEqual(fields, savedFields));
  const editInProgress = isDirty || detailsEditing;

  // `list` is the entries as they will be, for after a save or delete has changed them
  function applySelection(next: Selection, list: Entry[] = entries) {
    setSelection(next);
    if (next.type === "existing") {
      const entry = list.find((e) => e.id === next.entryId);
      if (entry) {
        setFields(entryToFields(entry));
        setSavedFields(entryToFields(entry));
        return;
      }
    }
    setFields(next.type === "new" ? newEntryFields(list) : blankEntryFields());
    setSavedFields(null);
  }

  function selectEntry(entryId: string) {
    if (editInProgress) return;
    applySelection({ type: "existing", entryId });
    setError(null);
  }

  function openNewEntry() {
    if (editInProgress || !pageIsEditable) return;
    applySelection({ type: "new" });
    setError(null);
  }

  function cancelEdit() {
    if (selection.type === "existing" && savedFields) {
      setFields(savedFields);
    } else {
      applySelection(pickDefaultSelection(entries, pageIsEditable));
    }
    setError(null);
  }

  function saveNew(andThen: "next" | "close") {
    runAction(startTransition, setError, async () => {
      const result = await createEntryAction(eventId, fieldsToInput(fields));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const updated = sortEntries([...entries, result.data]);
      setEntries(updated);
      if (andThen === "next") {
        setFields(newEntryFields(updated));
        setSavedFields(null);
        setFocusPlayerToken((token) => token + 1);
      } else {
        applySelection(pickDefaultSelection(updated, pageIsEditable), updated);
      }
    });
  }

  function saveExisting() {
    if (selection.type !== "existing") return;
    const entryId = selection.entryId;
    runAction(startTransition, setError, async () => {
      const result = await updateEntryAction(entryId, fieldsToInput(fields));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEntries(sortEntries(entries.map((e) => (e.id === entryId ? result.data : e))));
      setFields(entryToFields(result.data));
      setSavedFields(entryToFields(result.data));
    });
  }

  function deleteSelected() {
    if (selection.type !== "existing") return;
    const entryId = selection.entryId;
    runAction(startTransition, setError, async () => {
      const result = await deleteEntryAction(entryId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const updated = entries.filter((e) => e.id !== entryId);
      setEntries(updated);
      applySelection(pickDefaultSelection(updated, pageIsEditable), updated);
    });
  }

  return {
    selection,
    fields,
    setFields,
    error,
    focusPlayerToken,
    scrollKey,
    editInProgress,
    selectEntry,
    openNewEntry,
    cancelEdit,
    saveNew,
    saveExisting,
    deleteSelected,
  };
}

function initialFields(selection: Selection, entries: Entry[]): EntryFieldValues {
  if (selection.type === "new") {
    return newEntryFields(entries);
  }
  if (selection.type === "existing") {
    const entry = entries.find((e) => e.id === selection.entryId);
    if (entry) return entryToFields(entry);
  }
  return blankEntryFields();
}
