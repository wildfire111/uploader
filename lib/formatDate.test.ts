import { describe, expect, it } from "vitest";
import { formatDisplayDate } from "./formatDate";

describe("formatDisplayDate", () => {
  it("formats a date as day, short month, year", () => {
    expect(formatDisplayDate("2026-09-14")).toBe("14 Sep 2026");
  });

  it("does not pad the day with a leading zero", () => {
    expect(formatDisplayDate("2026-01-05")).toBe("5 Jan 2026");
  });

  it("handles December", () => {
    expect(formatDisplayDate("2026-12-31")).toBe("31 Dec 2026");
  });
});
