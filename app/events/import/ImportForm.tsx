"use client";

import { useState, useTransition, type FormEvent } from "react";
import { importEventAction } from "@/lib/actions/events";
import { extractPdfPages } from "@/lib/pdfImport/extract";
import { formatPlayerName } from "@/lib/pdfImport/entry";
import { MeleeFormatError, parseMeleePdf } from "@/lib/pdfImport/melee";
import {
  MAX_ATTENDANCE,
  MAX_EVENT_FULL_NAME_LENGTH,
  MAX_EVENT_NAME_LENGTH,
  MAX_EVENT_YEAR,
  MIN_EVENT_YEAR,
} from "@/lib/validation";

export function ImportForm() {
  const [isPending, startTransition] = useTransition();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const file = form.get("pdf");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose the Melee decklist PDF.");
      return;
    }

    let entries;
    setReading(true);
    try {
      const lists = parseMeleePdf(await extractPdfPages(file));
      entries = lists.map((list) => ({
        playerName: formatPlayerName(list.playerName),
        deckName: list.deckName,
        decklistRaw: list.decklistRaw,
      }));
    } catch (problem) {
      setError(
        problem instanceof MeleeFormatError
          ? problem.message
          : "That file couldn't be read as a PDF."
      );
      return;
    } finally {
      setReading(false);
    }

    const details = {
      name: String(form.get("name") ?? ""),
      fullName: String(form.get("fullName") ?? ""),
      date: String(form.get("date") ?? ""),
      attendance: Number(form.get("attendance")),
    };
    startTransition(async () => {
      // on success the action redirects to the new event
      const result = await importEventAction(details, entries);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  const busy = reading || isPending;

  return (
    <form onSubmit={onSubmit}>
      {error ? <p className="error">{error}</p> : null}

      <label htmlFor="name">Event code</label>
      <input
        type="text"
        id="name"
        name="name"
        maxLength={MAX_EVENT_NAME_LENGTH}
        placeholder="GGGongIQ26"
        required
      />
      <p className="-mt-2 text-sm text-muted">The short code that goes in each deck&apos;s title.</p>

      <label htmlFor="fullName">Full event name</label>
      <input
        type="text"
        id="fullName"
        name="fullName"
        maxLength={MAX_EVENT_FULL_NAME_LENGTH}
        placeholder="Adventurers Guild IQ"
        required
      />

      <label htmlFor="date">Date</label>
      <input
        type="date"
        id="date"
        name="date"
        min={`${MIN_EVENT_YEAR}-01-01`}
        max={`${MAX_EVENT_YEAR}-12-31`}
        required
      />

      <label htmlFor="attendance">Attendance</label>
      <input
        type="number"
        id="attendance"
        name="attendance"
        min={1}
        max={MAX_ATTENDANCE}
        step={1}
        required
      />

      <label htmlFor="pdf">Melee decklist PDF</label>
      <input type="file" id="pdf" name="pdf" accept="application/pdf,.pdf" required />
      <p className="-mt-2 text-sm text-muted">
        The &ldquo;Decklist Multi-print&rdquo; PDF from Melee.gg. It&apos;s read in your browser and
        isn&apos;t uploaded. Placings are entered after the import.
      </p>

      <button type="submit" data-variant="primary" disabled={busy}>
        {reading ? "Reading PDF…" : isPending ? "Importing…" : "Import"}
      </button>
    </form>
  );
}
