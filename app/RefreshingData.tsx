"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { refreshStaleListsAction } from "@/lib/actions/referenceData";

// Holds the page behind a popup while the lists in `names` (the stale ones, worked out by the
// page on the server) are fetched, then reloads the page's data so it has them. Does nothing when
// `names` is empty.
export function RefreshingData({ names }: { names: string[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const key = names.join(",");
  const startedFor = useRef("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !key || startedFor.current === key) {
      return;
    }
    startedFor.current = key;
    if (!dialog.open) {
      dialog.showModal();
    }
    refreshStaleListsAction(key.split(","))
      .then(() => router.refresh())
      // the page carries on with the lists it has; the attempt is on record, so it isn't retried at once
      .catch(() => {})
      .finally(() => dialog.close());
  }, [key, router]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Updating cached data"
      // Escape doesn't dismiss it
      onCancel={(event) => event.preventDefault()}
      style={{ padding: "20px 28px", border: "1px solid #888", borderRadius: 8 }}
    >
      <strong>Updating cached data…</strong>
      <p style={{ margin: "8px 0 0" }}>
        Card lists are refreshed about once a day. This takes a few seconds.
      </p>
    </dialog>
  );
}
