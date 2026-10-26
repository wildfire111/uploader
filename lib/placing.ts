export type PlacingRange = {
  placingFrom: number;
  placingTo: number | null;
  // an imported list has a placeholder placing until someone assigns the real one; absent means placed
  placingAssigned?: boolean;
};

function isPlaced(range: PlacingRange): boolean {
  return range.placingAssigned !== false;
}

// wide enough for the biggest placing in the event: 01st up to 99 players, 001st up to 999, and so on
function placingWidth(attendance: number): number {
  return Math.max(2, String(attendance).length);
}

export function formatOrdinal(position: number, attendance: number): string {
  const padded = String(position).padStart(placingWidth(attendance), "0");
  const lastTwoDigits = position % 100;

  // 11th to 13th are always "th"
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${padded}th`;
  }

  const lastDigit = position % 10;
  if (lastDigit === 1) return `${padded}st`;
  if (lastDigit === 2) return `${padded}nd`;
  if (lastDigit === 3) return `${padded}rd`;
  return `${padded}th`;
}

export function formatPlacing(range: PlacingRange, attendance: number): string {
  if (!isPlaced(range)) {
    return "Unplaced";
  }
  if (range.placingTo === null) {
    return formatOrdinal(range.placingFrom, attendance);
  }
  return `${formatOrdinal(range.placingFrom, attendance)}/${formatOrdinal(range.placingTo, attendance)}`;
}

// repeats a shared range until it's full, then moves on (03rd/04th at 3, 05th/08th at 5)
export function suggestNextPlacing(allEntries: PlacingRange[]): PlacingRange {
  const existingEntries = allEntries.filter(isPlaced);
  if (existingEntries.length === 0) {
    return { placingFrom: 1, placingTo: null };
  }

  const highestPlacingFrom = Math.max(...existingEntries.map((entry) => entry.placingFrom));
  // entries can share a start but be different ranges, so use the latest one
  const startingAtHighest = existingEntries.filter(
    (entry) => entry.placingFrom === highestPlacingFrom
  );
  const lastRange = startingAtHighest[startingAtHighest.length - 1];
  const lastRangeEntries = startingAtHighest.filter(
    (entry) => entry.placingTo === lastRange.placingTo
  );

  if (lastRange.placingTo !== null) {
    const rangeSize = lastRange.placingTo - lastRange.placingFrom + 1;
    if (lastRangeEntries.length < rangeSize) {
      return { placingFrom: lastRange.placingFrom, placingTo: lastRange.placingTo };
    }
  }

  const nextPosition =
    lastRange.placingTo !== null ? lastRange.placingTo + 1 : lastRange.placingFrom + 1;

  if (nextPosition === 3) {
    return { placingFrom: 3, placingTo: 4 };
  }
  if (nextPosition === 5) {
    return { placingFrom: 5, placingTo: 8 };
  }
  return { placingFrom: nextPosition, placingTo: null };
}

export type PlacingWarnings = {
  // exact placings (no "to") held by more than one entry
  duplicates: number[];
  // places nobody holds, between a placing below and a placing above
  skipped: number[];
};

// Things worth a second look before submitting. They never block: ties are written as bands, and
// bands that overlap are left alone.
export function placingWarnings(entries: PlacingRange[]): PlacingWarnings {
  const placedEntries = entries.filter(isPlaced);

  const exactCounts = new Map<number, number>();
  for (const entry of placedEntries) {
    if (entry.placingTo === null) {
      exactCounts.set(entry.placingFrom, (exactCounts.get(entry.placingFrom) ?? 0) + 1);
    }
  }
  const duplicates = [...exactCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([placing]) => placing)
    .sort((a, b) => a - b);

  if (placedEntries.length === 0) {
    return { duplicates, skipped: [] };
  }

  const held = new Set<number>();
  let lowest = Infinity;
  let highest = -Infinity;
  for (const entry of placedEntries) {
    const last = entry.placingTo ?? entry.placingFrom;
    lowest = Math.min(lowest, entry.placingFrom);
    highest = Math.max(highest, last);
    for (let place = entry.placingFrom; place <= last; place++) {
      held.add(place);
    }
  }

  const skipped: number[] = [];
  for (let place = lowest + 1; place < highest; place++) {
    if (!held.has(place)) {
      skipped.push(place);
    }
  }
  return { duplicates, skipped };
}
