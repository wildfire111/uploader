import { describe, expect, it } from "vitest";
import {
  MAX_DECK_NAME_LENGTH,
  MAX_DECKLIST_LENGTH,
  MAX_ATTENDANCE,
  MAX_EVENT_FULL_NAME_LENGTH,
  MAX_EVENT_NAME_LENGTH,
  MAX_PLAYER_NAME_LENGTH,
  validateEntryInput,
  validateEventDetails,
} from "./validation";

const goodEntry = {
  placingFrom: 1,
  placingTo: null,
  playerName: "Anthony P",
  deckName: "Storm",
  decklistRaw: "1 Lion's Eye Diamond",
};

describe("validateEntryInput", () => {
  it("accepts a normal entry", () => {
    expect(validateEntryInput(goodEntry)).toBeNull();
  });

  it("requires a whole-number placing of 1 or more", () => {
    expect(validateEntryInput({ ...goodEntry, placingFrom: 0 })).toMatch(/placing/i);
    expect(validateEntryInput({ ...goodEntry, placingFrom: 1.5 })).toMatch(/placing/i);
  });

  it("requires placing (to) to be greater than placing (from)", () => {
    expect(validateEntryInput({ ...goodEntry, placingFrom: 3, placingTo: 3 })).toMatch(/greater/i);
    expect(validateEntryInput({ ...goodEntry, placingFrom: 3, placingTo: 4 })).toBeNull();
  });

  it("requires player, deck and decklist", () => {
    expect(validateEntryInput({ ...goodEntry, playerName: "" })).toMatch(/required/i);
    expect(validateEntryInput({ ...goodEntry, deckName: "" })).toMatch(/required/i);
    expect(validateEntryInput({ ...goodEntry, decklistRaw: "   " })).toMatch(/required/i);
  });

  it("rejects over-long fields", () => {
    expect(
      validateEntryInput({ ...goodEntry, playerName: "x".repeat(MAX_PLAYER_NAME_LENGTH + 1) })
    ).toMatch(/player/i);
    expect(
      validateEntryInput({ ...goodEntry, deckName: "x".repeat(MAX_DECK_NAME_LENGTH + 1) })
    ).toMatch(/deck/i);
    expect(
      validateEntryInput({ ...goodEntry, decklistRaw: "x".repeat(MAX_DECKLIST_LENGTH + 1) })
    ).toMatch(/decklist/i);
  });

  it("accepts fields exactly at the limit", () => {
    expect(
      validateEntryInput({ ...goodEntry, decklistRaw: "x".repeat(MAX_DECKLIST_LENGTH) })
    ).toBeNull();
  });
});

describe("validateEventDetails", () => {
  const good = {
    name: "GGGongIQ26",
    fullName: "Adventurers Guild IQ",
    date: "2026-09-14",
    attendance: 32,
  };

  it("accepts normal event details", () => {
    expect(validateEventDetails(good)).toBeNull();
  });

  it("requires a code, a full name, a real date, and attendance of at least 1", () => {
    expect(validateEventDetails({ ...good, name: "  " })).toMatch(/code/i);
    expect(validateEventDetails({ ...good, fullName: "  " })).toMatch(/full event name/i);
    expect(validateEventDetails({ ...good, date: "" })).toMatch(/date/i);
    expect(validateEventDetails({ ...good, attendance: 0 })).toMatch(/attendance/i);
    expect(validateEventDetails({ ...good, attendance: 2.5 })).toMatch(/attendance/i);
  });

  it("rejects a date that doesn't exist, like 31 February", () => {
    expect(validateEventDetails({ ...good, date: "2026-02-31" })).toMatch(/date/i);
  });

  it("rejects an attendance too big for the database, and accepts exactly the limit", () => {
    expect(validateEventDetails({ ...good, attendance: 99_999_999_999 })).toMatch(/attendance/i);
    expect(validateEventDetails({ ...good, attendance: MAX_ATTENDANCE + 1 })).toMatch(/attendance/i);
    expect(validateEventDetails({ ...good, attendance: MAX_ATTENDANCE })).toBeNull();
  });

  it("only accepts dates from 2000 to 2099", () => {
    expect(validateEventDetails({ ...good, date: "1999-12-31" })).toMatch(/2000 and 2099/);
    expect(validateEventDetails({ ...good, date: "2100-01-01" })).toMatch(/2000 and 2099/);
    expect(validateEventDetails({ ...good, date: "0000-01-01" })).toMatch(/2000 and 2099/);
    expect(validateEventDetails({ ...good, date: "2000-01-01" })).toBeNull();
    expect(validateEventDetails({ ...good, date: "2099-12-31" })).toBeNull();
  });

  it("rejects an over-long event code", () => {
    expect(
      validateEventDetails({ ...good, name: "x".repeat(MAX_EVENT_NAME_LENGTH + 1) })
    ).toMatch(/code/i);
  });

  it("rejects an over-long full event name, and accepts one exactly at the limit", () => {
    expect(
      validateEventDetails({ ...good, fullName: "x".repeat(MAX_EVENT_FULL_NAME_LENGTH + 1) })
    ).toMatch(/full event name/i);
    expect(
      validateEventDetails({ ...good, fullName: "x".repeat(MAX_EVENT_FULL_NAME_LENGTH) })
    ).toBeNull();
  });
});
