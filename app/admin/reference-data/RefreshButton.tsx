"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshReferenceListAction } from "@/lib/actions/referenceData";

export function RefreshButton({ name, noun }: { name: string; noun: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function refresh() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await refreshReferenceListAction(name);
        setMessage(
          result.ok
            ? { ok: true, text: `Updated (${result.data.count.toLocaleString("en-AU")} ${noun}).` }
            : { ok: false, text: result.error }
        );
        router.refresh();
      } catch {
        setMessage({ ok: false, text: "Something went wrong. Please try again." });
      }
    });
  }

  return (
    <>
      <button type="button" data-variant="primary" onClick={refresh} disabled={isPending}>
        {isPending ? "Updating…" : "Update now"}
      </button>
      {message ? <p className={message.ok ? "success" : "error"}>{message.text}</p> : null}
    </>
  );
}
