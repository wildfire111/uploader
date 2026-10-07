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

  it.each(["Sideboard", "Sideboard:", "SIDEBOARD", "sideboard:", "// Sideboard", "SB:"])(
    "splits on a %s header",
    (header) => {
      const lines = parseDecklist(`1 Flash\n\n${header}\n1 Lightning Bolt`);
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

  it("uses a single blank line as the divider when there is no header", () => {
    const lines = parseDecklist("1 Flash\n1 Black Lotus\n\n1 Lightning Bolt");
    expect(lines.map((line) => line.board)).toEqual(["main", "main", "side"]);
  });

  it("leaves three or more groups alone", () => {
    const lines = parseDecklist("1 Flash\n\n1 Black Lotus\n\n1 Lightning Bolt");
    expect(lines.every((line) => line.board === "main")).toBe(true);
  });
});
