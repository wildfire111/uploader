"use client";

import { useEffect, useState, type Dispatch, type SetStateAction, type TransitionStartFunction } from "react";
import type { Entry, Event } from "@/lib/types";

// after a failed publish, Publish stays disabled this long so a retry can't follow straight on
// from the failed request (a 429 asks for a wait, and a timed-out request may still be running)
const RETRY_LOCK_SECONDS = 60;

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
  // seconds until Publish can be clicked again after a failure; null when it can be clicked now
  const [retryInSeconds, setRetryInSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (retryInSeconds === null) {
      return;
    }
    const timer = setTimeout(
      () => setRetryInSeconds(retryInSeconds > 1 ? retryInSeconds - 1 : null),
      1000
    );
    return () => clearTimeout(timer);
  }, [retryInSeconds]);

  function publish() {
    if (retryInSeconds !== null) {
      return;
    }
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
        setRetryInSeconds(RETRY_LOCK_SECONDS);
      }
    });
  }

  return { progress, error, retryInSeconds, publish };
}
