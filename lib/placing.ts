export type PlacingRange = {
  placingFrom: number;
  placingTo: number | null;
};

export function formatOrdinal(position: number): string {
  const padded = String(position).padStart(2, "0");
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

export function formatPlacing(range: PlacingRange): string {
  if (range.placingTo === null) {
    return formatOrdinal(range.placingFrom);
  }
  return `${formatOrdinal(range.placingFrom)}/${formatOrdinal(range.placingTo)}`;
}

// repeats a shared range until it's full, then moves on (03rd/04th at 3, 05th/08th at 5)
export function suggestNextPlacing(existingEntries: PlacingRange[]): PlacingRange {
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
