"use server";

import { redirect } from "next/navigation";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { getCurrentUser } from "@/lib/auth";
import { NOT_LOGGED_IN, requireUser } from "@/lib/guards";
import {
  canDeleteEvent,
  canEditEventDetails,
  canReopenEvent,
  canReturnToDraft,
  canSubmitEvent,
  canUnlockMetadata,
} from "@/lib/permissions";
import { getEntriesForEvent } from "@/lib/queries/entries";
import {
  createEvent,
  createEventWithImportedEntries,
  deleteEvent,
  getEventById,
  setEventStatus,
  setEventStatusAndRelock,
  setMetadataUnlocked,
  updateEventDetails,
} from "@/lib/queries/events";
import { MAX_IMPORT_ENTRIES, normaliseImportedEntry, type ImportedEntry } from "@/lib/pdfImport/entry";
import { checkTitleLength, formatDeckTitle } from "@/lib/title";
import type { Event, EventDetailsInput } from "@/lib/types";
import { validateEventDetails } from "@/lib/validation";

export async function createEventAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const attendanceRaw = String(formData.get("attendance") ?? "").trim();
  const attendance = Number(attendanceRaw);

  const problem = validateEventDetails({ name, fullName, date, attendance });
  if (problem) {
    const params = new URLSearchParams({
      error: problem,
      name,
      fullName,
      date,
      attendance: attendanceRaw,
    });
    redirect(`/events/new?${params.toString()}`);
  }

  const event = await createEvent({ name, fullName, date, attendance, createdBy: user.email });
  redirect(`/events/${event.id}`);
}

// The PDF is read in the browser; only the lists come here. The browser can send anything, so each
// list is cleaned up again. Nothing about a list stops the import: odd ones are fixed afterwards.
export async function importEventAction(
  details: EventDetailsInput,
  entries: ImportedEntry[]
): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) {
    return actionError(NOT_LOGGED_IN);
  }

  const cleanDetails: EventDetailsInput = {
    name: String(details?.name ?? "").trim(),
    fullName: String(details?.fullName ?? "").trim(),
    date: String(details?.date ?? "").trim(),
    attendance: Number(details?.attendance),
  };
  const problem = validateEventDetails(cleanDetails);
  if (problem) {
    return actionError(problem);
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return actionError("There are no decklists to import.");
  }
  if (entries.length > MAX_IMPORT_ENTRIES) {
    return actionError(`That's more than ${MAX_IMPORT_ENTRIES.toLocaleString("en-AU")} decklists.`);
  }
  const cleanEntries = entries.map((entry) =>
    normaliseImportedEntry({
      playerName: String(entry?.playerName ?? ""),
      deckName: String(entry?.deckName ?? ""),
      decklistRaw: String(entry?.decklistRaw ?? ""),
    })
  );

  const event = await createEventWithImportedEntries(
    { ...cleanDetails, createdBy: user.email },
    cleanEntries
  );
  redirect(`/events/${event.id}`);
}

export async function updateEventDetailsAction(
  eventId: string,
  input: EventDetailsInput
): Promise<ActionResult<Event>> {
  const user = await getCurrentUser();
  if (!user) {
    return actionError(NOT_LOGGED_IN);
  }

  const event = await getEventById(eventId);
  if (!event) {
    return actionError("This event no longer exists.");
  }
  const entries = await getEntriesForEvent(eventId);
  if (!canEditEventDetails(user, event, entries)) {
    return actionError("You don't have permission to edit this event's details.");
  }

  const problem = validateEventDetails(input);
  if (problem) {
    return actionError(problem);
  }

  // a longer event code or a bigger attendance (wider placings) can push existing titles over 100 characters
  if (input.name !== event.name || input.attendance !== event.attendance) {
    for (const entry of entries) {
      const titleProblem = checkTitleLength(formatDeckTitle({
          ...entry,
          eventName: input.name,
          attendance: input.attendance,
        }));
      if (titleProblem) {
        return actionError(
          `That event code doesn't fit ${entry.playerName}'s entry. ${titleProblem}`
        );
      }
    }
  }

  return actionOk(await updateEventDetails(eventId, input));
}

export async function deleteEventAction(eventId: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) {
    return actionError(NOT_LOGGED_IN);
  }

  const event = await getEventById(eventId);
  if (!event) {
    redirect("/");
  }
  if (!canDeleteEvent(user, event)) {
    return actionError("You don't have permission to delete this event.");
  }

  await deleteEvent(eventId);
  redirect("/");
}

export async function submitEventAction(eventId: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) {
    return actionError(NOT_LOGGED_IN);
  }

  const event = await getEventById(eventId);
  if (!event) {
    return actionError("This event no longer exists.");
  }
  const entries = await getEntriesForEvent(eventId);
  if (!canSubmitEvent(user, event, entries)) {
    return actionError("This event can't be submitted right now.");
  }

  await setEventStatus(eventId, "submitted");
  redirect("/?submitted=1");
}

export async function reopenEventAction(eventId: string): Promise<ActionResult<Event>> {
  const user = await getCurrentUser();
  if (!user) {
    return actionError(NOT_LOGGED_IN);
  }

  const event = await getEventById(eventId);
  if (!event) {
    return actionError("This event no longer exists.");
  }
  if (!canReopenEvent(user, event)) {
    return actionError("This event can't be reopened.");
  }

  return actionOk(await setEventStatus(eventId, "submitted"));
}

export async function returnToDraftAction(eventId: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) {
    return actionError(NOT_LOGGED_IN);
  }

  const event = await getEventById(eventId);
  if (!event) {
    return actionError("This event no longer exists.");
  }
  if (!canReturnToDraft(user, event)) {
    return actionError("This event can't be returned to draft.");
  }

  await setEventStatusAndRelock(eventId, "draft");
  redirect("/");
}

export async function unlockMetadataAction(eventId: string): Promise<ActionResult<Event>> {
  const user = await getCurrentUser();
  if (!user) {
    return actionError(NOT_LOGGED_IN);
  }

  const event = await getEventById(eventId);
  if (!event) {
    return actionError("This event no longer exists.");
  }
  const entries = await getEntriesForEvent(eventId);
  if (!canUnlockMetadata(user, event, entries)) {
    return actionError("This event's details can't be unlocked.");
  }

  return actionOk(await setMetadataUnlocked(eventId, true));
}
