import { describe, expect, it } from "vitest";
import { normaliseCompanions, setCompanion } from "./companion";

describe("normaliseCompanions", () => {
  it("moves a Companion line and its card to the end of the sideboard, marked (Companion)", () => {
    const raw = "Companion\n1 Lurrus of the Dream-Den\n1 Flash\nSideboard\n1 Island";
    expect(normaliseCompanions(raw)).toBe("1 Flash\nSideboard\n1 Island\n1 Lurrus of the Dream-Den (Companion)");
  });

  it("keeps the quantity, set code and foil marker as written", () => {
    expect(normaliseCompanions("1 Flash\nSideboard\n1 Island\nCompanion:\n2x Lurrus of the Dream-Den (MH1) 226 *F*")).toBe(
      "1 Flash\nSideboard\n1 Island\n2x Lurrus of the Dream-Den (MH1) 226 *F* (Companion)"
    );
  });

  it("adds a Sideboard line when there isn't one", () => {
    expect(normaliseCompanions("1 Flash\nCompanion\n1 Lurrus of the Dream-Den\n")).toBe(
      "1 Flash\nSideboard\n1 Lurrus of the Dream-Den (Companion)"
    );
  });

  it("marks the sideboard line instead of duplicating a card that is already there", () => {
    expect(normaliseCompanions("Companion\n1 Lurrus of the Dream-Den\nSideboard\n1 lurrus of the dream den\n1 Island")).toBe(
      "Sideboard\n1 lurrus of the dream den (Companion)\n1 Island"
    );
  });

  it("converts every companion it finds, so a second one still warns", () => {
    expect(normaliseCompanions("Companion\n1 Lurrus of the Dream-Den\nCompanion\n1 Zirda, the Dawnwaker\n1 Flash")).toBe(
      "1 Flash\nSideboard\n1 Lurrus of the Dream-Den (Companion)\n1 Zirda, the Dawnwaker (Companion)"
    );
  });

  it("leaves text alone when there is nothing to convert", () => {
    for (const raw of [
      "1 Flash\nSideboard\n1 Island",
      "1 Flash\nSideboard\n1 Lurrus of the Dream-Den (Companion)",
      "1 Flash\nCompanion\n\n1 Island",
      "1 Flash\nCompanion",
    ]) {
      expect(normaliseCompanions(raw)).toBe(raw);
    }
  });

  it("asks before treating a card with companion in its name as a marker", () => {
    const raw = "1 Faithful Companion\nSideboard\n1 Island";
    expect(normaliseCompanions(raw, (name) => name === "Faithful Companion")).toBe(raw);
  });
});

describe("setCompanion", () => {
  it("marks a sideboard card (Companion) where it is", () => {
    const raw = "1 Flash\nSideboard\n1 Lurrus of the Dream-Den (MH1) 226\n1 Island";
    expect(setCompanion(raw, "Lurrus of the Dream-Den")).toBe(
      "1 Flash\nSideboard\n1 Lurrus of the Dream-Den (MH1) 226 (Companion)\n1 Island"
    );
  });

  it("finds the card whatever the case", () => {
    expect(setCompanion("1 Flash\nSB: 1 lurrus of the dream-den", "Lurrus of the Dream-Den")).toBe(
      "1 Flash\nSB: 1 lurrus of the dream-den (Companion)"
    );
  });

  it("leaves the text alone when the card isn't in the sideboard", () => {
    const raw = "1 Lurrus of the Dream-Den\nSideboard\n1 Island";
    expect(setCompanion(raw, "Lurrus of the Dream-Den")).toBe(raw);
  });

  it("takes the mark off when cleared", () => {
    expect(setCompanion("1 Flash\nSideboard\n1 Lurrus of the Dream-Den (Companion)\n1 Island", null)).toBe(
      "1 Flash\nSideboard\n1 Lurrus of the Dream-Den\n1 Island"
    );
  });

  it("moves the mark when another card is chosen", () => {
    expect(
      setCompanion("Sideboard\n1 Lurrus of the Dream-Den (Companion)\n1 Zirda, the Dawnwaker", "Zirda, the Dawnwaker")
    ).toBe("Sideboard\n1 Lurrus of the Dream-Den\n1 Zirda, the Dawnwaker (Companion)");
  });

  it("rewrites a Companion line and card into the sideboard when the mark is cleared", () => {
    expect(setCompanion("Companion\n1 Lurrus of the Dream-Den\n1 Flash\nSideboard\n1 Island", null)).toBe(
      "1 Flash\nSideboard\n1 Island\n1 Lurrus of the Dream-Den"
    );
  });

  it("can mark a card when the list was in the Companion-line form", () => {
    expect(setCompanion("Companion\n1 Lurrus of the Dream-Den\n1 Flash\nSideboard\n1 Zirda, the Dawnwaker", "Zirda, the Dawnwaker")).toBe(
      "1 Flash\nSideboard\n1 Zirda, the Dawnwaker (Companion)\n1 Lurrus of the Dream-Den"
    );
  });
});
