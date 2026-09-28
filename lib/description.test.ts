import { describe, expect, it } from "vitest";
import { formatDeckDescription } from "./description";

describe("formatDeckDescription", () => {
  it("formats the worked example", () => {
    expect(
      formatDeckDescription({ date: "2026-09-27", fullName: "Adventurers Guild IQ", attendance: 22 })
    ).toBe("27/09/26, Adventurers Guild IQ, 22 players");
  });

  it("puts the day first and keeps leading zeros", () => {
    expect(formatDeckDescription({ date: "2026-01-05", fullName: "X", attendance: 8 })).toBe(
      "05/01/26, X, 8 players"
    );
  });

  it("uses a two-digit year", () => {
    expect(formatDeckDescription({ date: "2031-12-31", fullName: "X", attendance: 8 })).toBe(
      "31/12/31, X, 8 players"
    );
  });

  it("says '1 player' for an attendance of one", () => {
    expect(formatDeckDescription({ date: "2026-09-27", fullName: "X", attendance: 1 })).toBe(
      "27/09/26, X, 1 player"
    );
  });

  it("trims stray spaces around the full name", () => {
    expect(formatDeckDescription({ date: "2026-09-27", fullName: "  Guild IQ ", attendance: 9 })).toBe(
      "27/09/26, Guild IQ, 9 players"
    );
  });
});
