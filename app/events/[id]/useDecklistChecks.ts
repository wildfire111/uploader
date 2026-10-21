"use client";

import { useDeferredValue, useMemo } from "react";
import { analyseDecklist } from "@/lib/decklist/analyse";
import { buildAliasIndex, buildCardNameSet, buildPointsIndex, buildReservedIndex } from "@/lib/decklist/lists";
import { checkDecklist } from "@/lib/decklist/rules";
import type { AliasList, CheckLists, DecklistWarning, PointsList } from "@/lib/decklist/types";
import type { Entry } from "@/lib/types";
import { useCardNames } from "./useCardNames";
import { usePointsList } from "./usePointsList";

// Loads the reference lists the checks need, and checks every entry against them.
export function useDecklistChecks({
  entries,
  pointsList,
  reservedNames,
  cardNamesVersion,
  aliasList,
  companionNames,
}: {
  entries: Entry[];
  // null until the points list has been loaded
  pointsList: PointsList | null;
  reservedNames: string[] | null;
  // when the stored card-name list was fetched; null until there is one
  cardNamesVersion: number | null;
  aliasList: AliasList | null;
  companionNames: string[] | null;
}) {
  const points = usePointsList(pointsList);
  const cardNames = useCardNames(cardNamesVersion);
  const lists = useMemo<CheckLists>(
    () => ({
      points: points ? buildPointsIndex(points) : null,
      reserved: reservedNames ? buildReservedIndex(reservedNames) : null,
      cardNames,
      aliases: aliasList ? buildAliasIndex(aliasList) : null,
      companions: companionNames ? buildCardNameSet(companionNames) : null,
    }),
    [points, reservedNames, cardNames, aliasList, companionNames]
  );

  // deferred, so saving an entry never waits on checking the others
  const deferredEntries = useDeferredValue(entries);
  const warningsByEntryId = useMemo(() => {
    const result = new Map<string, DecklistWarning[]>();
    for (const entry of deferredEntries) {
      const warnings = checkDecklist(analyseDecklist(entry.decklistRaw, lists));
      if (warnings.length > 0) {
        result.set(entry.id, warnings);
      }
    }
    return result;
  }, [deferredEntries, lists]);

  return { lists, warningsByEntryId };
}
