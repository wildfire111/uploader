"use client";

import { useEffect, useState } from "react";

// The stored land list, once it arrives; null until then, or for good if there is none. Basic lands
// are known without it (isBasicLand in plan.ts).
export function useLandNames(): Set<string> | null {
  const [names, setNames] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lands")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled && Array.isArray(body?.names)) {
          setNames(new Set(body.names));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return names;
}
