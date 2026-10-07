"use server";

import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { getCurrentUser } from "@/lib/auth";
import { NOT_LOGGED_IN } from "@/lib/guards";
import { canEditEntry, canEditEvent } from "@/lib/permissions";
import { createEntry, deleteEntry, getEntryById, updateEntry } from "@/lib/queries/entries";
import { getEventById } from "@/lib/queries/events";
import { checkTitleLength, formatDeckTitle } from "@/lib/title";
import type { Entry, EntryInput } from "@/lib/types";
import { validateEntryInput } from "@/lib/validation";

function titleProblem(eventName: string, input: EntryInput): string | null {
  return checkTitleLength(formatDeckTitle({ ...input, eventName }));
}

export async function createEntryAction(
  eventId: string,
  input: EntryInput
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

  const problem = validateEntryInput(input) ?? titleProblem(event.name, input);
  if (problem) {
    return actionError(problem);
  }

  return actionOk(await createEntry({ eventId, ...input }));
}

export async function updateEntryAction(
  entryId: string,
  input: EntryInput
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

  const problem = validateEntryInput(input) ?? titleProblem(event.name, input);
  if (problem) {
    return actionError(problem);
  }

  return actionOk(await updateEntry(entryId, input));
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
