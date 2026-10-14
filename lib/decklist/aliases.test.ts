import { describe, expect, it } from "vitest";
import { replaceAliases } from "./aliases";
import { aliasIndex } from "./fixtures";

describe("replaceAliases", () => {
  it("swaps a flavor name for the real name, keeping quantity, set and foil marker", () => {
    const raw = "1 Widow-Making Infiltrator\r\n2x Widow-Making Infiltrator (MAR) 63 *F*\nSB: 1 widow-making infiltrator\n1 Island";
    expect(replaceAliases(raw, aliasIndex)).toBe(
      "1 Dauthi Voidwalker\r\n2x Dauthi Voidwalker (MAR) 63 *F*\nSB: 1 Dauthi Voidwalker\n1 Island"
    );
  });

  it("leaves headers and unknown names alone, and does nothing without aliases", () => {
    const raw = "Sideboard\n1 Island";
    expect(replaceAliases(raw, aliasIndex)).toBe(raw);
    expect(replaceAliases("1 Widow-Making Infiltrator", null)).toBe("1 Widow-Making Infiltrator");
  });
});
