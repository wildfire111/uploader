"use client";

import { useState, type Dispatch, type SetStateAction, type TransitionStartFunction } from "react";
import { updateEventDetailsAction } from "@/lib/actions/events";
import type { Event } from "@/lib/types";
import { validateEventDetails } from "@/lib/validation";
import { runAction } from "./runAction";

export type EventDetailsEditor = ReturnType<typeof useEventDetails>;

type DetailsFields = { name: string; fullName: string; date: string; attendance: string };

function fieldsFor(event: Event): DetailsFields {
  return {
    name: event.name,
    fullName: event.fullName,
    date: event.date,
    attendance: String(event.attendance),
  };
}

// Editing the event's code, name, date and attendance in place.
export function useEventDetails({
  event,
  setEvent,
  startTransition,
}: {
  event: Event;
  setEvent: Dispatch<SetStateAction<Event>>;
  startTransition: TransitionStartFunction;
}) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<DetailsFields>(() => fieldsFor(event));
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    const attendance = Number(fields.attendance);
    const problem = validateEventDetails({ ...fields, attendance });
    if (problem) {
      setError(problem);
      return;
    }
    runAction(startTransition, setError, async () => {
      const result = await updateEventDetailsAction(event.id, {
        name: fields.name.trim(),
        fullName: fields.fullName.trim(),
        date: fields.date,
        attendance,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEvent(result.data);
      setEditing(false);
    });
  }

  function cancel() {
    setFields(fieldsFor(event));
    setEditing(false);
    setError(null);
  }

  return { editing, start: () => setEditing(true), fields, setFields, error, save, cancel };
}
