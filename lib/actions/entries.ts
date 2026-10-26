"use server";

import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { getCurrentUser } from "@/lib/auth";
import { loadCardNameCheck } from "@/lib/cardNameLists";
import { normaliseCompanions } from "@/lib/decklist/companion";
import { NOT_LOGGED_IN } from "@/lib/guards";
import { canEditEntry, canEditEvent } from "@/lib/permissions";
import {
  assignPlacing,
  createEntry,
  deleteEntry,
  getEntryById,
  updateEntry,
} from "@/lib/queries/entries";
import { getEventById } from "@/lib/queries/events";
import { checkTitleLength, formatDeckTitle } from "@/lib/title";
import type { Entry, EntryInput, Event } from "@/lib/types";
import { validateEntryInput, validatePlacing } from "@/lib/validation";

function titleProblem(event: Event, input: EntryInput): string | null {
  return checkTitleLength(
    formatDeckTitle({ ...input, eventName: event.name, attendance: event.attendance })
  );
}

// a companion is saved as "(Companion)" after its card in the sideboard, however the list wrote it
async function tidied(input: EntryInput): Promise<EntryInput> {
  const { isCardName } = await loadCardNameCheck();
  return { ...input, decklistRaw: normaliseCompanions(input.decklistRaw, isCardName) };
}

export async function createEntryAction(
  eventId: string,
  rawInput: EntryInput
): Promise<ActionResult<Entry>> {
  const user = await getCurrentUser();
  if (!user) {
    return actionError(NOT_LOGGED_IN);
  }

  const event = await getEventById(eventId);
  if (!event) {
    return actionError("This event no longer exists.");
  }
  if (!canEditEvent(user, event)) {
    return actionError("You don't have permission to add entries to this event.");
  }

  const input = await tidied(rawInput);
  const problem = validateEntryInput(input) ?? titleProblem(event, input);
  if (problem) {
    return actionError(problem);
  }

  return actionOk(await createEntry({ eventId, ...input }));
}

export async function updateEntryAction(
  entryId: string,
  rawInput: EntryInput
): Promise<ActionResult<Entry>> {
  const user = await getCurrentUser();
  if (!user) {
    return actionError(NOT_LOGGED_IN);
  }

  const entry = await getEntryById(entryId);
  if (!entry) {
    return actionError("This entry no longer exists.");
  }
  const event = await getEventById(entry.eventId);
  if (!event) {
    return actionError("This event no longer exists.");
  }
  if (!canEditEntry(user, event, entry)) {
    return actionError("You don't have permission to edit this entry.");
  }

  // an unplaced list can be fixed up with its placing left blank (the form sends 0), and stays
  // unplaced; any placing typed in places it
  const staysUnplaced =
    !entry.placingAssigned && rawInput.placingFrom === 0 && rawInput.placingTo === null;
  const input = await tidied(
    staysUnplaced ? { ...rawInput, placingFrom: entry.placingFrom } : rawInput
  );
  const problem = validateEntryInput(input) ?? titleProblem(event, input);
  if (problem) {
    return actionError(problem);
  }

  return actionOk(await updateEntry(entryId, input, entry.placingAssigned || !staysUnplaced));
}

// quick assign: the real placing for an imported list that doesn't have one yet
export async function assignPlacingAction(
  entryId: string,
  placingFrom: number,
  placingTo: number | null
): Promise<ActionResult<Entry>> {
  const user = await getCurrentUser();
  if (!user) {
    return actionError(NOT_LOGGED_IN);
  }

  const entry = await getEntryById(entryId);
  if (!entry) {
    return actionError("This entry no longer exists.");
  }
  const event = await getEventById(entry.eventId);
  if (!event) {
    return actionError("This event no longer exists.");
  }
  if (!canEditEntry(user, event, entry)) {
    return actionError("You don't have permission to place this entry.");
  }

  const problem = validatePlacing(placingFrom, placingTo);
  if (problem) {
    return actionError(problem);
  }
  const titleIssue = titleProblem(event, { ...entry, placingFrom, placingTo });
  if (titleIssue) {
    return actionError(titleIssue);
  }

  return actionOk(await assignPlacing(entryId, { placingFrom, placingTo }));
}

// undo for quick assign: puts the list back as unplaced, where it sat in the import
export async function unplaceEntryAction(
  entryId: string,
  placeholder: number
): Promise<ActionResult<Entry>> {
  const user = await getCurrentUser();
  if (!user) {
    return actionError(NOT_LOGGED_IN);
  }

  const entry = await getEntryById(entryId);
  if (!entry) {
    return actionError("This entry no longer exists.");
  }
  const event = await getEventById(entry.eventId);
  if (!event) {
    return actionError("This event no longer exists.");
  }
  if (!canEditEntry(user, event, entry)) {
    return actionError("You don't have permission to change this entry.");
  }
  if (!Number.isInteger(placeholder) || placeholder < 1) {
    return actionError("That placing isn't valid.");
  }

  return actionOk(await assignPlacing(entryId, null, placeholder));
}

export async function deleteEntryAction(entryId: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) {
    return actionError(NOT_LOGGED_IN);
  }

  const entry = await getEntryById(entryId);
  if (!entry) {
    return actionOk(null);
  }
  const event = await getEventById(entry.eventId);
  if (!event) {
    return actionError("This event no longer exists.");
  }
  if (!canEditEntry(user, event, entry)) {
    return actionError("You don't have permission to delete this entry.");
  }

  await deleteEntry(entryId);
  return actionOk(null);
}
