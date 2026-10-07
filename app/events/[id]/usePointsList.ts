"use client";

import { useEffect, useState } from "react";
import type { PointsList } from "@/lib/decklist/types";

// The server sends the points list when it already has one. Otherwise (the very first load, or
// GitHub was unreachable) ask for it after the page is up. Returns null until there is one.
export function usePointsList(fromServer: PointsList | null): PointsList | null {
  const [loaded, setLoaded] = useState<PointsList | null>(null);

  useEffect(() => {
    if (fromServer) {
      return;
    }
    let cancelled = false;
    fetch("/api/points")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled && body?.points) {
          setLoaded(body.points);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fromServer]);

  return fromServer ?? loaded;
}
