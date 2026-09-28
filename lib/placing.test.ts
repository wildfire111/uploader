import { describe, expect, it } from "vitest";
import { formatOrdinal, formatPlacing, suggestNextPlacing, type PlacingRange } from "./placing";

describe("suggestNextPlacing", () => {
  it("suggests 01st for the first entry of an empty event", () => {
    expect(suggestNextPlacing([])).toEqual({ placingFrom: 1, placingTo: null });
  });

  it("suggests the standard top 8 sequence as entries are added", () => {
    const entries: PlacingRange[] = [];
    const suggestions: string[] = [];

    for (let i = 0; i < 9; i++) {
      const suggestion = suggestNextPlacing(entries);
      suggestions.push(formatPlacing(suggestion));
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
    expect(formatOrdinal(position)).toBe(expected);
  });
});

describe("formatPlacing", () => {
  it("formats a single placing", () => {
    expect(formatPlacing({ placingFrom: 1, placingTo: null })).toBe("01st");
  });

  it("formats a shared range with both ends joined by a slash", () => {
    expect(formatPlacing({ placingFrom: 1, placingTo: 4 })).toBe("01st/04th");
    expect(formatPlacing({ placingFrom: 5, placingTo: 8 })).toBe("05th/08th");
  });
});
