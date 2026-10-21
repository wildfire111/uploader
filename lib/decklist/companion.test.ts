import { describe, expect, it } from "vitest";
import { setCompanion } from "./companion";

describe("setCompanion", () => {
  it("moves a sideboard card under a Companion line at the top", () => {
    const raw = "1 Flash\nSideboard\n1 Lurrus of the Dream-Den (MH1) 226\n1 Island";
    expect(setCompanion(raw, "Lurrus of the Dream-Den")).toBe(
      "Companion\n1 Lurrus of the Dream-Den (MH1) 226\n1 Flash\nSideboard\n1 Island"
    );
  });

  it("finds the card whatever the case, and drops an SB: prefix", () => {
    expect(setCompanion("1 Flash\nSB: 1 lurrus of the dream-den", "Lurrus of the Dream-Den")).toBe(
      "Companion\n1 lurrus of the dream-den\n1 Flash"
    );
  });

  it("leaves the text alone when the card isn't in the sideboard", () => {
    const raw = "1 Lurrus of the Dream-Den\nSideboard\n1 Island";
    expect(setCompanion(raw, "Lurrus of the Dream-Den")).toBe(raw);
  });

  it("puts a companion back in the sideboard when it is cleared", () => {
    const raw = "Companion\n1 Lurrus of the Dream-Den\n1 Flash\nSideboard\n1 Island";
    expect(setCompanion(raw, null)).toBe("1 Flash\nSideboard\n1 Island\n1 Lurrus of the Dream-Den");
  });

  it("adds a Sideboard line to put the old companion under when there is none", () => {
    expect(setCompanion("1 Flash\nCompanion\n1 Lurrus of the Dream-Den", null)).toBe(
      "1 Flash\nSideboard\n1 Lurrus of the Dream-Den"
    );
  });

  it("swaps one companion for another", () => {
    const raw = "Companion\n1 Lurrus of the Dream-Den\n1 Flash\nSideboard\n1 Zirda, the Dawnwaker";
    expect(setCompanion(raw, "Zirda, the Dawnwaker")).toBe(
      "Companion\n1 Zirda, the Dawnwaker\n1 Flash\nSideboard\n1 Lurrus of the Dream-Den"
    );
  });
});
