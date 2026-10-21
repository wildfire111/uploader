import { describe, expect, it } from "vitest";
import { parseDecklist } from "./parse";

describe("parseDecklist", () => {
  it("reads quantities, 1x and a missing quantity", () => {
    expect(parseDecklist("1 Flash\n2x Lightning Bolt\nBlack Lotus")).toEqual([
      { name: "Flash", quantity: 1, board: "main" },
      { name: "Lightning Bolt", quantity: 2, board: "main" },
      { name: "Black Lotus", quantity: 1, board: "main" },
    ]);
  });

  it("does not eat the start of a name that begins with x", () => {
    expect(parseDecklist("3 Xenagos, the Reveler")[0]).toMatchObject({
      name: "Xenagos, the Reveler",
      quantity: 3,
    });
    expect(parseDecklist("1 X Marks the Spot")[0].name).toBe("X Marks the Spot");
  });

  it("drops set codes, collector numbers and foil markers", () => {
    expect(parseDecklist("1 Lightning Bolt (M21) 152\n1 Flash (MH2) *F*\n1 Black Lotus *F*")).toEqual([
      { name: "Lightning Bolt", quantity: 1, board: "main" },
      { name: "Flash", quantity: 1, board: "main" },
      { name: "Black Lotus", quantity: 1, board: "main" },
    ]);
  });

  it.each(["Sideboard", "Sideboard:", "SIDEBOARD", "sideboard:", "// Sideboard", "SB:", "Sideboard (15)", "// SIDEBOARD CARDS"])(
    "splits on a %s line",
    (header) => {
      const lines = parseDecklist(`1 Flash\n${header}\n1 Lightning Bolt`);
      expect(lines.map((line) => line.board)).toEqual(["main", "side"]);
    }
  );

  it("treats SB: prefixed lines as sideboard", () => {
    const lines = parseDecklist("1 Flash\nSB: 1 Lightning Bolt\n1 Black Lotus");
    expect(lines.map((line) => line.board)).toEqual(["main", "side", "main"]);
  });

  it("skips a Deck header at the top and keeps the cards as maindeck", () => {
    const lines = parseDecklist("Deck\n1 Flash\n1 Black Lotus\n\nSideboard\n1 Lightning Bolt");
    expect(lines.map((line) => line.board)).toEqual(["main", "main", "side"]);
  });

  it("is not thrown by blank lines or a card with 'side' in its name", () => {
    const lines = parseDecklist("\n\n1 Flash\n1 Sideswipe\n1 Outside Chance\n\n");
    expect(lines.map((line) => line.board)).toEqual(["main", "main", "main"]);
  });

  it("ignores blank lines when splitting the sideboard", () => {
    const lines = parseDecklist("1 Flash\n1 Black Lotus\n\n1 Lightning Bolt");
    expect(lines.every((line) => line.board === "main")).toBe(true);
    const spaced = parseDecklist("1 Flash\n\n1 Black Lotus\n\nSideboard\n\n1 Lightning Bolt");
    expect(spaced.map((line) => line.board)).toEqual(["main", "main", "side"]);
  });

  it("strips * points markers from names", () => {
    expect(parseDecklist("1 Lightning Bolt *\n1 *Flash\n1* Black Lotus\n2 Ponder ** (MH2) 152 *")).toEqual([
      { name: "Lightning Bolt", quantity: 1, board: "main" },
      { name: "Flash", quantity: 1, board: "main" },
      { name: "Black Lotus", quantity: 1, board: "main" },
      { name: "Ponder", quantity: 2, board: "main" },
    ]);
  });

  describe("companion", () => {
    const COMPANION = { companion: true, board: "side" };

    it("puts the card after a Companion line in the sideboard, wherever the marker is", () => {
      const head = parseDecklist("Companion\n1 Lurrus of the Dream-Den\n1 Flash\nSideboard\n1 Lightning Bolt");
      expect(head).toEqual([
        { name: "Lurrus of the Dream-Den", quantity: 1, ...COMPANION },
        { name: "Flash", quantity: 1, board: "main" },
        { name: "Lightning Bolt", quantity: 1, board: "side" },
      ]);
      const middle = parseDecklist("1 Flash\n// Companion\n1 Lurrus of the Dream-Den\n1 Black Lotus");
      expect(middle.map((line) => [line.name, line.board])).toEqual([
        ["Flash", "main"],
        ["Lurrus of the Dream-Den", "side"],
        ["Black Lotus", "main"],
      ]);
    });

    it("keeps the quantity as written and accepts a marker with a colon or a quantity", () => {
      expect(parseDecklist("Companion:\n3 Lurrus of the Dream-Den")[0]).toMatchObject({ quantity: 3, companion: true });
      expect(parseDecklist("1 Companion\nLurrus of the Dream-Den")[0]).toMatchObject({
        name: "Lurrus of the Dream-Den",
        companion: true,
      });
    });

    it("merges a companion that is also listed in the sideboard", () => {
      const lines = parseDecklist("Companion\n1 Lurrus of the Dream-Den\nSideboard\n1 Lurrus of the Dream-Den\n1 Flash");
      expect(lines.filter((line) => line.name === "Lurrus of the Dream-Den")).toHaveLength(1);
      expect(lines.find((line) => line.name === "Lurrus of the Dream-Den")?.companion).toBe(true);
      expect(lines).toHaveLength(2);
    });

    it("ignores a marker followed by a blank line or nothing", () => {
      expect(parseDecklist("1 Flash\nCompanion\n\n1 Black Lotus")).toEqual([
        { name: "Flash", quantity: 1, board: "main" },
        { name: "Black Lotus", quantity: 1, board: "main" },
      ]);
      expect(parseDecklist("1 Flash\nCompanion")).toEqual([{ name: "Flash", quantity: 1, board: "main" }]);
    });

    it("waits for a card when markers are repeated", () => {
      const lines = parseDecklist("Companion\nCompanion\n1 Lurrus of the Dream-Den");
      expect(lines).toEqual([{ name: "Lurrus of the Dream-Den", quantity: 1, ...COMPANION }]);
    });

    it("keeps every card after a second marker flagged, so the analysis can warn", () => {
      const lines = parseDecklist("Companion\n1 Lurrus of the Dream-Den\nCompanion\n1 Zirda, the Dawnwaker");
      expect(lines.filter((line) => line.companion)).toHaveLength(2);
    });

    it("asks the validator before treating a line as a marker", () => {
      const isCardName = (name: string) => name === "Faithful Companion";
      expect(parseDecklist("1 Faithful Companion\n1 Flash", isCardName)).toEqual([
        { name: "Faithful Companion", quantity: 1, board: "main" },
        { name: "Flash", quantity: 1, board: "main" },
      ]);
      expect(parseDecklist("Companion\n1 Lurrus of the Dream-Den", isCardName)[0]).toMatchObject({ companion: true });
    });

    describe("(Companion) after the card", () => {
      it("declares the card the companion wherever the line is, and drops the text from the name", () => {
        expect(parseDecklist("1 Flash\n1 Lurrus of the Dream-Den (Companion)\nSideboard\n1 Island")).toEqual([
          { name: "Flash", quantity: 1, board: "main" },
          { name: "Lurrus of the Dream-Den", quantity: 1, board: "side", companion: true },
          { name: "Island", quantity: 1, board: "side" },
        ]);
      });

      it("reads it in any case, with a set code, foil marker or points marker around it", () => {
        for (const line of [
          "1 Lurrus of the Dream-Den (companion)",
          "1 Lurrus of the Dream-Den (MH1) 226 (COMPANION)",
          "1 Lurrus of the Dream-Den *F* (Companion)",
          "SB: 1 Lurrus of the Dream-Den (Companion) *",
        ]) {
          expect(parseDecklist(`Sideboard\n${line}`)).toEqual([
            { name: "Lurrus of the Dream-Den", quantity: 1, board: "side", companion: true },
          ]);
        }
      });

      it("merges a companion that is also listed plainly in the sideboard", () => {
        const lines = parseDecklist("Sideboard\n1 Lurrus of the Dream-Den\n1 Lurrus of the Dream-Den (Companion)");
        expect(lines).toEqual([{ name: "Lurrus of the Dream-Den", quantity: 1, board: "side", companion: true }]);
      });

      it("counts a second one as another companion", () => {
        const lines = parseDecklist("Sideboard\n1 Lurrus of the Dream-Den (Companion)\n1 Zirda, the Dawnwaker (Companion)");
        expect(lines.filter((line) => line.companion)).toHaveLength(2);
      });
    });
  });
});
