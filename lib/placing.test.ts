import { describe, expect, it } from "vitest";
import {
  formatOrdinal,
  formatPlacing,
  placingWarnings,
  suggestNextPlacing,
  type PlacingRange,
} from "./placing";

function placed(placingFrom: number, placingTo: number | null = null): PlacingRange {
  return { placingFrom, placingTo, placingAssigned: true };
}

describe("unplaced entries", () => {
  const unplaced: PlacingRange = { placingFrom: 7, placingTo: null, placingAssigned: false };

  it("formats as Unplaced instead of showing the placeholder", () => {
    expect(formatPlacing(unplaced, 22)).toBe("Unplaced");
  });

  it("is ignored when suggesting the next placing", () => {
    expect(suggestNextPlacing([placed(1), unplaced])).toEqual({ placingFrom: 2, placingTo: null });
    expect(suggestNextPlacing([unplaced])).toEqual({ placingFrom: 1, placingTo: null });
  });
});

describe("placingWarnings", () => {
  it("has nothing to say about a clean set of placings", () => {
    expect(placingWarnings([placed(1), placed(2), placed(3, 4), placed(3, 4), placed(5)])).toEqual({
      duplicates: [],
      skipped: [],
    });
  });

  it("flags two entries on the same exact placing", () => {
    expect(placingWarnings([placed(1), placed(2), placed(2), placed(3)]).duplicates).toEqual([2]);
  });

  it("does not flag a shared band, even when it holds more entries than places", () => {
    expect(placingWarnings([placed(1), placed(2, 3), placed(2, 3), placed(2, 3)]).duplicates).toEqual([]);
  });

  it("only compares exact placings with each other, whatever bands are around them", () => {
    expect(placingWarnings([placed(9, 16), placed(12), placed(12)]).duplicates).toEqual([12]);
    expect(placingWarnings([placed(9, 16), placed(12)]).duplicates).toEqual([]);
  });

  it("flags a skipped place only when something sits below and above it", () => {
    expect(placingWarnings([placed(1), placed(2), placed(4)]).skipped).toEqual([3]);
    expect(placingWarnings([placed(3), placed(4)]).skipped).toEqual([]);
    expect(placingWarnings([placed(1), placed(2)]).skipped).toEqual([]);
  });

  it("counts every place in a band as held", () => {
    expect(placingWarnings([placed(1), placed(2, 8), placed(9)]).skipped).toEqual([]);
    expect(placingWarnings([placed(1), placed(3, 4), placed(7)]).skipped).toEqual([2, 5, 6]);
  });

  it("ignores unplaced entries", () => {
    const unplaced: PlacingRange = { placingFrom: 2, placingTo: null, placingAssigned: false };
    expect(placingWarnings([placed(1), unplaced, placed(3)]).skipped).toEqual([2]);
    expect(placingWarnings([placed(1), unplaced, unplaced]).duplicates).toEqual([]);
  });
});

describe("suggestNextPlacing", () => {
  it("suggests 01st for the first entry of an empty event", () => {
    expect(suggestNextPlacing([])).toEqual({ placingFrom: 1, placingTo: null });
  });

  it("suggests the standard top 8 sequence as entries are added", () => {
    const entries: PlacingRange[] = [];
    const suggestions: string[] = [];

    for (let i = 0; i < 9; i++) {
      const suggestion = suggestNextPlacing(entries);
      suggestions.push(formatPlacing(suggestion, 22));
      entries.push(suggestion);
    }

    expect(suggestions).toEqual([
      "01st",
      "02nd",
      "03rd/04th",
      "03rd/04th",
      "05th/08th",
      "05th/08th",
      "05th/08th",
      "05th/08th",
      "09th",
    ]);
  });

  it("fills the next three placings when the first entry is overridden to a top 4 split", () => {
    const entries: PlacingRange[] = [{ placingFrom: 1, placingTo: 4 }];

    const second = suggestNextPlacing(entries);
    expect(second).toEqual({ placingFrom: 1, placingTo: 4 });
    entries.push(second);

    const third = suggestNextPlacing(entries);
    expect(third).toEqual({ placingFrom: 1, placingTo: 4 });
    entries.push(third);

    const fourth = suggestNextPlacing(entries);
    expect(fourth).toEqual({ placingFrom: 1, placingTo: 4 });
    entries.push(fourth);

    const fifth = suggestNextPlacing(entries);
    expect(fifth).toEqual({ placingFrom: 5, placingTo: 8 });
  });

  it("fills a manually-set 09th/16th range for all 8 entries before moving on", () => {
    let entries: PlacingRange[] = [{ placingFrom: 9, placingTo: 16 }];

    for (let i = 0; i < 7; i++) {
      const next = suggestNextPlacing(entries);
      expect(next).toEqual({ placingFrom: 9, placingTo: 16 });
      entries = [...entries, next];
    }

    const afterRange = suggestNextPlacing(entries);
    expect(afterRange).toEqual({ placingFrom: 17, placingTo: null });
  });

  it("keeps filling a range that starts at the same place as an earlier single placing", () => {
    const entries: PlacingRange[] = [
      { placingFrom: 9, placingTo: null },
      { placingFrom: 9, placingTo: 16 },
    ];
    expect(suggestNextPlacing(entries)).toEqual({ placingFrom: 9, placingTo: 16 });
  });

  it("counts only entries with exactly the same range as filling it", () => {
    const entries: PlacingRange[] = [
      { placingFrom: 9, placingTo: null },
      ...Array.from({ length: 7 }, () => ({ placingFrom: 9, placingTo: 16 })),
    ];
    expect(suggestNextPlacing(entries)).toEqual({ placingFrom: 9, placingTo: 16 });
  });
});

describe("formatOrdinal", () => {
  it.each([
    [1, "01st"],
    [2, "02nd"],
    [3, "03rd"],
    [4, "04th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
  ])("formats %i as %s", (position, expected) => {
    expect(formatOrdinal(position, 22)).toBe(expected);
  });
});

describe("formatPlacing", () => {
  it("formats a single placing", () => {
    expect(formatPlacing({ placingFrom: 1, placingTo: null }, 22)).toBe("01st");
  });

  it("formats a shared range with both ends joined by a slash", () => {
    expect(formatPlacing({ placingFrom: 1, placingTo: 4 }, 22)).toBe("01st/04th");
    expect(formatPlacing({ placingFrom: 5, placingTo: 8 }, 22)).toBe("05th/08th");
  });

  it("pads to three digits from 100 players and four from 1000", () => {
    const range = { placingFrom: 5, placingTo: 8 };
    expect(formatPlacing(range, 99)).toBe("05th/08th");
    expect(formatPlacing(range, 100)).toBe("005th/008th");
    expect(formatPlacing(range, 999)).toBe("005th/008th");
    expect(formatPlacing(range, 1000)).toBe("0005th/0008th");
    expect(formatPlacing(range, 9999)).toBe("0005th/0008th");
  });
});
