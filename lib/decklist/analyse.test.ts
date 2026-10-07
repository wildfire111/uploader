import { describe, expect, it } from "vitest";
import type { CardNameSet } from "./types";
import { analyse, index, knownCards } from "./fixtures";

describe("analyseDecklist", () => {
  it("totals points across both boards, using quantity", () => {
    const analysis = analyse("1 Ancestral Recall\n2 Lightning Bolt\n\nSideboard\n1 Flash", index);
    expect(analysis.total).toBe(5 + 2 + 3);
  });

  it("matches a double-faced card named by its front face only", () => {
    expect(analyse("1 Tamiyo, Inquisitive Student", index).total).toBe(2);
    expect(analyse("1 Tamiyo, Inquisitive Student // Tamiyo, Seasoned Scholar", index).total).toBe(2);
  });

  it("matches curly apostrophes and ignores case", () => {
    expect(analyse("1 thassa’s oracle", index).total).toBe(5);
  });

  it("counts cards per board by quantity", () => {
    const analysis = analyse("4 Island\n1 Flash\n\nSideboard\n2 Lightning Bolt", index);
    expect(analysis.mainCount).toBe(5);
    expect(analysis.sideCount).toBe(2);
  });

  it("has a null total without a points list", () => {
    expect(analyse("1 Flash", null).total).toBeNull();
  });

  it("can ask whether a card is present", () => {
    const analysis = analyse("1 Flash", index);
    expect(analysis.has("flash")).toBe(true);
    expect(analysis.has("Black Lotus")).toBe(false);
  });
});

describe("unrecognised card names", () => {
  const unknownCards = (raw: string, names: CardNameSet | null = knownCards) =>
    analyse(raw, null, null, names).unknownCards;

  it("accepts real names, with quantities, set codes, foil markers and headers", () => {
    expect(unknownCards("Deck\n4 Island\n1x Flash (MH2) 12\n1 Lightning Bolt *F*\n\nSideboard\nSB: 1 Flash")).toEqual([]);
  });

  it("accepts a double-faced card by its front, in full, and in split-card spellings", () => {
    expect(
      unknownCards("1 Delver of Secrets\n1 Delver of Secrets // Insectile Aberration\n1 Fire // Ice\n1 Fire/Ice\n1 Fire//Ice")
    ).toEqual([]);
  });

  it("ignores case, accents, hyphens and spacing", () => {
    expect(unknownCards("1 LIGHTNING  BOLT\n1 thassa\u2019s oracle\n1 Fl\u00e1sh")).toEqual([]);
  });

  it("flags a back face on its own", () => {
    expect(unknownCards("1 Insectile Aberration")).toEqual(["Insectile Aberration"]);
  });

  it("flags a name that is not a card", () => {
    expect(unknownCards("1 Completely Made Up Card")).toEqual(["Completely Made Up Card"]);
  });

  it("lists each unknownCards card once", () => {
    expect(unknownCards("1 Flassh\n2 Flassh\n1 flassh")).toHaveLength(1);
  });

  it("finds nothing without a card-name list", () => {
    expect(unknownCards("1 Thasa's Oracle", null)).toEqual([]);
  });
});
