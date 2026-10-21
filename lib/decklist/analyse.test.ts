import { describe, expect, it } from "vitest";
import { analyseDecklist } from "./analyse";
import { buildCardNameSet } from "./lists";
import type { CardNameSet } from "./types";
import { aliasIndex, analyse, index, knownCards } from "./fixtures";

describe("analyseDecklist with flavor names", () => {
  it("scores a flavor name as the card it is printed on", () => {
    expect(analyse("1 Widow-Making Infiltrator", index, null, null, aliasIndex).total).toBe(4);
  });

  it("does not flag a flavor name as unknown", () => {
    const analysis = analyse("1 Widow-Making Infiltrator", index, null, knownCards, aliasIndex);
    expect(analysis.unknownCards).toEqual([]);
    expect(analysis.has("Dauthi Voidwalker")).toBe(true);
  });

  it("flags the flavor name when no alias list is available", () => {
    expect(analyse("1 Widow-Making Infiltrator", index, null, knownCards).unknownCards).toEqual([
      "Widow-Making Infiltrator",
    ]);
  });
});

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

describe("analyseDecklist with a companion", () => {
  const companions = buildCardNameSet(["Lurrus of the Dream-Den", "Zirda, the Dawnwaker"]);
  const run = (raw: string, cardNames: CardNameSet | null = knownWithCompanions) =>
    analyseDecklist(raw, { points: index, reserved: null, cardNames, aliases: aliasIndex, companions });
  const knownWithCompanions = buildCardNameSet([
    "Flash",
    "Faithful Companion",
    "Lurrus of the Dream-Den",
    "Zirda, the Dawnwaker",
    "Dauthi Voidwalker",
  ]);

  it("puts the companion in the sideboard count and scores it", () => {
    const analysis = run("1 Flash\nCompanion\n1 Lurrus of the Dream-Den");
    expect(analysis.companion).toBe("Lurrus of the Dream-Den");
    expect(analysis.mainCount).toBe(1);
    expect(analysis.sideCount).toBe(1);
    expect(analysis.total).toBe(6);
    expect(analysis.companionEligible).toBe(true);
    expect(analysis.unknownCards).toEqual([]);
  });

  it("counts a companion written with another quantity as one card", () => {
    const analysis = run("Companion\n3 Lurrus of the Dream-Den");
    expect(analysis.sideCount).toBe(1);
    expect(analysis.companionQuantity).toBe(3);
    expect(run("Companion\n1 Lurrus of the Dream-Den").companionQuantity).toBeNull();
  });

  it("reports the companions after the first", () => {
    const analysis = run("Companion\n1 Lurrus of the Dream-Den\nCompanion\n1 Zirda, the Dawnwaker");
    expect(analysis.companion).toBe("Lurrus of the Dream-Den");
    expect(analysis.extraCompanions).toEqual(["Zirda, the Dawnwaker"]);
  });

  it("knows when the companion is not on the list of eligible cards", () => {
    expect(run("Companion\n1 Flash").companionEligible).toBe(false);
  });

  it("does not check eligibility without the list", () => {
    const analysis = analyseDecklist("Companion\n1 Flash", {
      points: index,
      reserved: null,
      cardNames: null,
      aliases: null,
      companions: null,
    });
    expect(analysis.companionEligible).toBeNull();
  });

  it("finds a card named companion by asking the card-name list", () => {
    const analysis = run("1 Faithful Companion\n1 Flash");
    expect(analysis.companion).toBeNull();
    expect(analysis.mainCount).toBe(2);
  });

  it("lists eligible sideboard cards only while no companion is declared", () => {
    expect(run("1 Flash\nSideboard\n1 Lurrus of the Dream-Den").possibleCompanions).toEqual([
      "Lurrus of the Dream-Den",
    ]);
    expect(run("1 Flash\nCompanion\n1 Lurrus of the Dream-Den").possibleCompanions).toEqual([]);
    expect(run("1 Lurrus of the Dream-Den").possibleCompanions).toEqual([]);
  });
});
