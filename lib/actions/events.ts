"use server";

import { redirect } from "next/navigation";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { getCurrentUser } from "@/lib/auth";
import { NOT_LOGGED_IN, requireUser } from "@/lib/guards";
import { canDeleteEvent, canEditEvent, canSubmitEvent } from "@/lib/permissions";
import { getEntriesForEvent } from "@/lib/queries/entries";
import {
  createEvent,
  deleteEvent,
  getEventById,
  setEventStatus,
  updateEventDetails,
} from "@/lib/queries/events";
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
  if (!canEditEvent(user, event)) {
    return actionError("You don't have permission to edit this event.");
  }

  const problem = validateEventDetails(input);
  if (problem) {
    return actionError(problem);
  }

  // a longer event code or a bigger attendance (wider placings) can push existing titles over 100 characters
  if (input.name !== event.name || input.attendance !== event.attendance) {
    for (const entry of await getEntriesForEvent(eventId)) {
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
