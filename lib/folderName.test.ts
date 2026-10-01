import { describe, expect, it } from "vitest";
import { formatDeckFolderName } from "./folderName";

describe("formatDeckFolderName", () => {
  it("formats the date as yyyymmdd and appends the full event name", () => {
    expect(formatDeckFolderName({ date: "2026-10-01", fullName: "Spring Championship" })).toBe(
      "20261001 - Spring Championship"
    );
  });

  it("trims the full event name", () => {
    expect(formatDeckFolderName({ date: "2026-01-05", fullName: "  Adventurers Guild IQ  " })).toBe(
      "20260105 - Adventurers Guild IQ"
    );
  });
});
