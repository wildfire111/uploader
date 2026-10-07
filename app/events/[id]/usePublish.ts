"use client";

import { useState, type Dispatch, type SetStateAction, type TransitionStartFunction } from "react";
import type { Entry, Event } from "@/lib/types";

const DUPLICATE_WARNING = "Check Moxfield for a duplicate of this deck before retrying.";

async function publishEntryOnServer(entryId: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`/api/entries/${entryId}/publish`, { method: "POST" });
  } catch {
    throw new Error(`The publish request failed to reach the server. ${DUPLICATE_WARNING}`);
  }

  if (response.status === 502) {
    const body = await response.json().catch(() => null);
    throw new Error(`${body?.error ?? "Moxfield publish failed."} ${DUPLICATE_WARNING}`);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Could not publish this entry.");
  }

  const body = (await response.json()) as { moxfieldDeckId: string };
  return body.moxfieldDeckId;
}

// Publishing an event: one entry per request, in placing order, then marking the event published.
export function usePublish({
  event,
  entries,
  setEvent,
  setEntries,
  startTransition,
}: {
  event: Event;
  entries: Entry[];
  setEvent: Dispatch<SetStateAction<Event>>;
  setEntries: Dispatch<SetStateAction<Entry[]>>;
  startTransition: TransitionStartFunction;
}) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function publish() {
    setError(null);
    const unpublished = entries.filter((entry) => entry.moxfieldDeckId === null);
    const total = entries.length;
    let done = total - unpublished.length;
    setProgress({ done, total });

    startTransition(async () => {
      try {
        for (const entry of unpublished) {
          const moxfieldDeckId = await publishEntryOnServer(entry.id);
          done += 1;
          setProgress({ done, total });
          setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, moxfieldDeckId } : e)));
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
        setProgress(null);
      } catch (publishError) {
        setError(publishError instanceof Error ? publishError.message : "Publishing failed.");
        setProgress(null);
      }
    });
  }

  return { progress, error, publish };
}
