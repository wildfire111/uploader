"use client";

import { useEffect, useMemo, useState } from "react";
import { buildCardNameSet } from "@/lib/decklist/lists";
import type { CardNameSet } from "@/lib/decklist/types";

// Downloads the card-name list after the page is up. The URL carries the list's version, so the
// browser keeps its copy until the list changes. Returns null until the names have arrived.
export function useCardNames(version: number | null): CardNameSet | null {
  const [names, setNames] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(version === null ? "/api/card-names" : `/api/card-names?v=${version}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled && Array.isArray(body?.names)) {
          setNames(body.names);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version]);

  return useMemo(() => (names ? buildCardNameSet(names) : null), [names]);
}
