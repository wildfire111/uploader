"use client";

import { useState, type ChangeEvent } from "react";
import { EntriesList } from "@/app/_decklist/EntriesList";
import { ReadonlyEntry } from "@/app/_decklist/ReadonlyEntry";
import { useDecklistChecks } from "@/app/_decklist/useDecklistChecks";
import { WarningSummary } from "@/app/_decklist/WarningSummary";
import type { AliasList, PointsList } from "@/lib/decklist/types";
import { formatPlayerName } from "@/lib/pdfImport/entry";
import { extractPdfPages } from "@/lib/pdfImport/extract";
import { MeleeFormatError, parseMeleePdf } from "@/lib/pdfImport/melee";

type CheckedList = {
  id: string;
  playerName: string;
  deckName: string;
  decklistRaw: string;
};

// The Melee decklist PDF is read in the browser and nothing is sent anywhere, so this needs no
// login and keeps no record of the lists.
export function CheckClient({
  pointsList,
  reservedNames,
  cardNamesVersion,
  aliasList,
  companionNames,
}: {
  pointsList: PointsList | null;
  reservedNames: string[] | null;
  cardNamesVersion: number | null;
  aliasList: AliasList | null;
  companionNames: string[] | null;
}) {
  const [lists, setLists] = useState<CheckedList[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { lists: checkLists, warningsByEntryId } = useDecklistChecks({
    entries: lists,
    pointsList,
    reservedNames,
    cardNamesVersion,
    aliasList,
    companionNames,
  });

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setError(null);
    setReading(true);
    try {
      const parsed = parseMeleePdf(await extractPdfPages(file)).map((list, index) => ({
        id: String(index),
        playerName: formatPlayerName(list.playerName) || "Unknown player",
        deckName: list.deckName || "Unknown deck",
        decklistRaw: list.decklistRaw,
      }));
      setLists(parsed);
      setFileName(file.name);
      setSelectedId(parsed[0]?.id ?? null);
    } catch (problem) {
      setError(
        problem instanceof MeleeFormatError
          ? problem.message
          : "That file couldn't be read as a PDF."
      );
    } finally {
      setReading(false);
      // so choosing the same file again still counts as a change
      event.target.value = "";
    }
  }

  const selected = lists.find((list) => list.id === selectedId);

  return (
    <main className="event-page">
      <div className="page-header">
        <h1>Decklist checker</h1>
      </div>
      <p className="text-muted">
        Choose the &ldquo;Decklist Multi-print&rdquo; PDF from Melee.gg to check every list in it.
        The PDF is read in your browser and isn&apos;t uploaded.
      </p>
      <p>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={onFile}
          disabled={reading}
          aria-label="Melee decklist PDF"
        />
        {reading ? " Reading PDF…" : null}
      </p>
      {error ? <p className="error">{error}</p> : null}

      {lists.length > 0 ? (
        <>
          <p>
            {fileName}: {lists.length} {lists.length === 1 ? "list" : "lists"},{" "}
            {warningsByEntryId.size} with problems
          </p>
          <WarningSummary warningsByEntryId={warningsByEntryId} />
          <div className="event-layout">
            <div className="entries-column">
              <EntriesList
                rows={lists.map((list, index) => ({
                  id: list.id,
                  label: String(index + 1),
                  playerName: list.playerName,
                  deckName: list.deckName,
                }))}
                selectedId={selectedId}
                onSelect={setSelectedId}
                warningsByEntryId={warningsByEntryId}
              />
            </div>
            <div className="entry-detail-pane">
              {selected ? (
                <ReadonlyEntry
                  playerName={selected.playerName}
                  deckName={selected.deckName}
                  decklistRaw={selected.decklistRaw}
                  lists={checkLists}
                />
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
