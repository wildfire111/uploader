import { describe, expect, it } from "vitest";
import { analyse, analyse as baseAnalyse, filler, index, knownCards, POINTS_FILE, reserved } from "./fixtures";
import { buildCardNameSet, buildPointsIndex, parsePointsFile } from "./lists";
import { allowedPointRange, checkDecklist, RULES, singletonRule } from "./rules";

// Most of these tests are about the points, size and card-name rules, and their fixture decks
// repeat cards for convenience, so they run every rule except singleton. It has its own tests.
const withoutSingleton = RULES.filter((rule) => rule !== singletonRule);
const check = (analysis: Parameters<typeof checkDecklist>[0]) => checkDecklist(analysis, withoutSingleton);

describe("checkDecklist", () => {
  // 5 + 2 = 7 points, 60 main and 15 side
  function goodDeck(extra = ""): string {
    return `1 Ancestral Recall\n1 Tamiyo, Inquisitive Student\n${filler(58)}\n\nSideboard\n${filler(15, "Side")}${extra}`;
  }

  it("has no warnings for a 7-point 60/15 list", () => {
    expect(check(analyse(goodDeck(), index))).toEqual([]);
  });

  it("accepts 8 points", () => {
    const deck = goodDeck().replace("1 Card 1\n", "1 Lightning Bolt\n");
    expect(analyse(deck, index).total).toBe(8);
    expect(check(analyse(deck, index))).toEqual([]);
  });

  it("flags 6 and 12 points", () => {
    const six = goodDeck().replace("1 Tamiyo, Inquisitive Student\n", "1 Lightning Bolt\n");
    expect(analyse(six, index).total).toBe(6);
    expect(check(analyse(six, index))).toEqual([
      { code: "points", message: "This list totals 6 points; expected 7 or 8." },
    ]);

    const twelve = goodDeck("\n1 Flash").replace("1 Card 1\n", "1 Lightning Bolt\n1 Lightning Bolt\n");
    const twelveAnalysis = analyse(twelve, index);
    expect(twelveAnalysis.total).toBe(12);
    expect(check(twelveAnalysis).some((w) => w.code === "points")).toBe(true);
  });

  it("skips the points rule but still checks size without a points list", () => {
    const warnings = check(analyse(`${filler(59)}\n\nSideboard\n${filler(15)}`, null));
    expect(warnings).toEqual([{ code: "deck-size", message: "Maindeck has 59 cards; expected 60." }]);
  });

  it("flags a short maindeck and a short sideboard together", () => {
    const warnings = check(analyse(`${filler(59)}\n\nSideboard\n${filler(14)}`, index));
    expect(warnings.map((w) => w.message)).toEqual(
      expect.arrayContaining([
        "Maindeck has 59 cards; expected 60.",
        "Sideboard has 14 cards; expected 15.",
      ])
    );
  });

  it("says when there is no sideboard", () => {
    const warnings = check(analyse(filler(60), index));
    expect(warnings.map((w) => w.message)).toContain("No sideboard found; expected 15 cards.");
  });

  it("sums quantities towards the size", () => {
    const deck = `4 Island\n${filler(56)}\n\nSideboard\n${filler(15)}`;
    expect(analyse(deck, index).mainCount).toBe(60);
    expect(check(analyse(deck, index)).some((w) => w.code === "deck-size")).toBe(false);
  });

  it("returns nothing for an empty list", () => {
    expect(check(analyse("  \n", index))).toEqual([]);
  });

  it("takes the allowed range from allowedPointRange only", () => {
    const analysis = analyse("1 Flash", index);
    expect(allowedPointRange(analysis)).toEqual({ min: 7, max: 8, reason: null });
  });

  describe("Reserved List cards", () => {
    // 3 + 2 + 2 = 7 points from cards that are not reserved
    function deck(extraMain: string, tweak: (deck: string) => string = (d) => d): string {
      return tweak(`1 Flash\n1 Tamiyo, Inquisitive Student\n1 Lightning Bolt\n1 Lightning Bolt\n${extraMain}\n${filler(55)}\n\nSideboard\n${filler(15, "Side")}`);
    }
    const eight = (d: string) => d.replace("1 Card 1\n", "1 Lightning Bolt\n");

    it("allows 8 points with no reserved cards", () => {
      const analysis = analyse(eight(deck("1 Island")), index, reserved);
      expect(analysis.total).toBe(8);
      expect(analysis.reservedCards).toEqual([]);
      expect(check(analysis)).toEqual([]);
    });

    it("allows 7 points with a reserved card", () => {
      const analysis = analyse(deck("1 Taiga"), index, reserved);
      expect(analysis.total).toBe(7);
      expect(check(analysis)).toEqual([]);
    });

    it("warns at 8 points with a reserved card, naming it", () => {
      const analysis = analyse(eight(deck("1 Taiga")), index, reserved);
      expect(analysis.total).toBe(8);
      expect(check(analysis)).toEqual([
        {
          code: "points",
          message: "This list totals 8 points; expected 7 because it has Reserved List cards (Taiga).",
        },
      ]);
    });

    it("counts a pointed reserved card too", () => {
      const analysis = analyse(deck("1 Black Lotus"), index, reserved);
      expect(analysis.reservedCards).toEqual(["Black Lotus"]);
      expect(analysis.total).toBe(12);
      expect(check(analysis).map((w) => w.code)).toContain("points");
    });

    it("lists each reserved card once and shortens a long list", () => {
      const analysis = analyse(
        eight(deck("1 Taiga\n1 Badlands\n1 Black Lotus\n1 Ancestral Recall\n2 Taiga")),
        index,
        reserved
      );
      expect(analysis.reservedCards).toEqual(["Taiga", "Badlands", "Black Lotus", "Ancestral Recall"]);
      expect(allowedPointRange(analysis).reason).toBe(
        "it has Reserved List cards (Taiga, Badlands, Black Lotus and 1 more)"
      );
    });

    it("finds a reserved card in the sideboard, in any case, with a set code", () => {
      const list = `${filler(60)}\n\nSideboard\n1 TAIGA (3ED) 300\n${filler(14, "Side")}`;
      expect(analyse(list, index, reserved).reservedCards).toEqual(["TAIGA"]);
    });

    it("does not treat lookalike names as reserved", () => {
      const analysis = analyse("1 Taiga Guide\n1 Black Lotus Petal", index, reserved);
      expect(analysis.reservedCards).toEqual([]);
    });

    it("keeps the default 7-8 range when the Reserved List isn't available", () => {
      const analysis = analyse(deck("1 Taiga"), index, null);
      expect(allowedPointRange(analysis)).toEqual({ min: 7, max: 8, reason: null });
    });
  });
  describe("pointed companions", () => {
    // a card only counts for its points when it is the declared companion; these are the cards
    // that could be
    const companions = buildCardNameSet(["Lurrus of the Dream-Den", "Lutri, the Spellchaser"]);
    const analyse = (raw: string, points: Parameters<typeof baseAnalyse>[1], reservedIndex = reserved) =>
      baseAnalyse(raw, points, reservedIndex, null, null, companions);
    // the suggestion to mark a sideboard companion has its own tests
    const check = (analysis: Parameters<typeof checkDecklist>[0]) =>
      checkDecklist(analysis, withoutSingleton).filter((warning) => warning.code !== "companion");
    // main: the given points plus filler. sideboard: Lurrus plus filler. Lurrus is only worth its
    // points (3) when it is the declared companion.
    function lurrusDeck(mainPoints: string, { companion = false, side = "1 Lurrus of the Dream-Den" } = {}): string {
      const sideboard = `Sideboard\n${companion ? "" : `${side}\n`}${filler(14, "Side")}`;
      return `${companion ? `Companion\n${side}\n` : ""}${mainPoints}\n${filler(56)}\n\n${sideboard}`;
    }
    // none of these are on the Reserved List
    const four = "1 Thassa's Oracle\n1 Card 1\n1 Card 2\n1 Card 3";
    const seven = "1 Thassa's Oracle\n1 Tamiyo, Inquisitive Student\n1 Card 1\n1 Card 2";
    const eight = "1 Thassa's Oracle\n1 Flash\n1 Card 1\n1 Card 2";

    it("does not count a sideboard Lurrus that isn't the companion", () => {
      const analysis = analyse(lurrusDeck(seven), index, reserved);
      expect(analysis.total).toBe(7);
      expect(check(analysis)).toEqual([]);
    });

    it("counts Lurrus once it is the declared companion", () => {
      const analysis = analyse(lurrusDeck(four, { companion: true }), index, reserved);
      expect(analysis.total).toBe(8);
      expect(check(analysis)).toEqual([]);
    });

    it("flags a list that is short because the companion wasn't declared", () => {
      // 5 points in the maindeck and Lurrus (3) in the sideboard: only the declared reading reaches 8
      const analysis = analyse(lurrusDeck(four), index, reserved);
      expect(analysis.total).toBe(5);
      expect(check(analysis)).toEqual([
        { code: "points", message: "This list totals 5 points; expected 7 or 8." },
      ]);
    });

    it("flags a declared companion that takes the list over the limit", () => {
      const analysis = analyse(lurrusDeck(eight, { companion: true }), index, reserved);
      expect(analysis.total).toBe(11);
      expect(check(analysis).map((w) => w.code)).toEqual(["points"]);
    });

    it("uses the Reserved List limit", () => {
      const withTaiga = "1 Lightning Bolt\n1 Flash\n1 Card 1\n1 Taiga";
      // 4 points + Lurrus (3) = 7, the cap with a reserved card
      expect(check(analyse(lurrusDeck(withTaiga, { companion: true }), index, reserved))).toEqual([]);
      // 5 + 3 = 8 is over it
      const over = "1 Thassa's Oracle\n1 Card 1\n1 Card 2\n1 Taiga";
      expect(check(analyse(lurrusDeck(over, { companion: true }), index, reserved)).map((w) => w.code)).toEqual(["points"]);
    });

    it("uses whatever Lurrus is currently worth on the points list", () => {
      const withValue = (points: number) =>
        buildPointsIndex(parsePointsFile(`${POINTS_FILE}\nLurrus of the Dream-Den ${points}`));
      expect(analyse(lurrusDeck(seven, { companion: true }), withValue(2), reserved).total).toBe(9);
      expect(analyse(lurrusDeck(seven, { companion: true }), withValue(0), reserved).total).toBe(7);
      expect(analyse(lurrusDeck(seven), withValue(5), reserved).total).toBe(7);
    });

    it("never counts a companion in the maindeck", () => {
      const main = `1 Ancestral Recall\n1 Tamiyo, Inquisitive Student\n1 Lurrus of the Dream-Den\n${filler(57)}\n\nSideboard\n${filler(15, "Side")}`;
      const analysis = analyse(main, index, reserved);
      expect(analysis.total).toBe(7);
      expect(check(analysis)).toEqual([]);
    });

    it("does the same for any other companion on the list", () => {
      const lutri = buildPointsIndex(parsePointsFile(`${POINTS_FILE}\nLutri, the Spellchaser 3`));
      const side = "1 Lutri, the Spellchaser";
      expect(analyse(lurrusDeck(seven, { side }), lutri, reserved).total).toBe(7);
      expect(analyse(lurrusDeck(seven, { side, companion: true }), lutri, reserved).total).toBe(10);
    });

    it("does not zero a pointed card that can't be a companion", () => {
      expect(analyse(lurrusDeck(seven, { side: "1 Flash" }), index, reserved).total).toBe(10);
    });

    it("matches the name with a space instead of the hyphen, in any case", () => {
      expect(analyse(lurrusDeck(seven, { side: "1 LURRUS OF THE DREAM DEN" }), index, reserved).total).toBe(7);
    });
  });

  describe("unrecognised card names", () => {
    it("turns into one warning per card", () => {
      const warnings = check(analyse("1 Thasa's Oracle\n1 Completely Made Up Card", null, null, knownCards));
      expect(warnings.filter((w) => w.code === "unknown-card").map((w) => w.message)).toEqual([
        'Unrecognised card: "Thasa\'s Oracle".',
        'Unrecognised card: "Completely Made Up Card".',
      ]);
    });

    it("shows five and counts the rest", () => {
      const lines = Array.from({ length: 8 }, (_, i) => `1 Zzzz Qqqq ${i}x`).join("\n");
      const messages = check(analyse(lines, null, null, knownCards))
        .filter((w) => w.code === "unknown-card")
        .map((w) => w.message);
      expect(messages).toHaveLength(6);
      expect(messages[5]).toBe("and 3 more unrecognised cards.");
    });

    it("does not touch the points or size checks", () => {
      const withNames = check(analyse("1 Flash", index, null, knownCards)).filter((w) => w.code !== "unknown-card");
      expect(withNames).toEqual(check(analyse("1 Flash", index)));
    });
  });

  describe("singleton", () => {
    const repeated = (raw: string) =>
      checkDecklist(analyse(raw, null), [singletonRule])
        .filter((warning) => warning.code === "singleton")
        .map((warning) => warning.message);

    it("allows a deck of unique cards", () => {
      expect(repeated("1 Flash\n1 Black Lotus\n\nSideboard\n1 Lightning Bolt")).toEqual([]);
    });

    it("flags a card listed twice, with its count", () => {
      expect(repeated("1 Flash\n1 Flash")).toEqual([
        '"Flash" appears 2 times; only basic lands can be repeated.',
      ]);
    });

    it("flags a quantity above one", () => {
      expect(repeated("3 Lightning Bolt")).toEqual([
        '"Lightning Bolt" appears 3 times; only basic lands can be repeated.',
      ]);
    });

    it("counts the maindeck and sideboard together", () => {
      expect(repeated("1 Flash\n\nSideboard\n1 Flash")).toHaveLength(1);
    });

    it.each([
      "Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes",
      "Snow-Covered Plains", "Snow-Covered Island", "Snow-Covered Swamp",
      "Snow-Covered Mountain", "Snow-Covered Forest", "Snow-Covered Wastes",
    ])("allows any number of %s", (land) => {
      expect(repeated(`12 ${land}\n\nSideboard\n3 ${land}`)).toEqual([]);
    });

    it("ignores case and the hyphen in snow-covered lands", () => {
      expect(repeated("5 snow covered island\n5 SNOW-COVERED ISLAND\n5 island")).toEqual([]);
    });

    it("does not treat lookalikes as basic lands", () => {
      expect(repeated("2 Snow Island")).toHaveLength(1);
      expect(repeated("2 Island Sanctuary")).toHaveLength(1);
      expect(repeated("2 Plains Walker")).toHaveLength(1);
    });

    it("sees the same card under different spellings", () => {
      expect(repeated("1 Delver of Secrets\n1 Delver of Secrets // Insectile Aberration")).toHaveLength(1);
      expect(repeated("1 Fire // Ice\n1 Fire/Ice")).toHaveLength(1);
      expect(repeated("1 Thassa's Oracle\n1 THASSA\u2019S ORACLE (THB) 73")).toHaveLength(1);
    });

    it("counts a repeated card once however many lines it is on", () => {
      expect(repeated("1 Flash\n1 Flash\n1 Flash")).toEqual([
        '"Flash" appears 3 times; only basic lands can be repeated.',
      ]);
    });

    it("shows five repeated cards and counts the rest", () => {
      const raw = Array.from({ length: 8 }, (_, i) => `2 Card ${i}`).join("\n");
      const messages = repeated(raw);
      expect(messages).toHaveLength(6);
      expect(messages[5]).toBe("and 3 more repeated cards.");
    });

    it("needs no card-name or points list", () => {
      expect(
        checkDecklist(analyse("1 Flash\n1 Flash", null), [singletonRule]).some((warning) => warning.code === "singleton")
      ).toBe(true);
    });
  });
});

describe("companion warnings", () => {
  const companions = buildCardNameSet(["Lurrus of the Dream-Den", "Zirda, the Dawnwaker"]);
  const warnings = (raw: string) =>
    checkDecklist(analyse(raw, index, null, null, null, companions), [RULES[RULES.length - 1]]);

  it("has none for a legal companion", () => {
    expect(warnings("1 Flash\nCompanion\n1 Lurrus of the Dream-Den")).toEqual([]);
  });

  it("flags a companion that can't be one, but still counts it", () => {
    expect(warnings("1 Flash\nCompanion\n1 Flash")).toEqual([
      { code: "companion", message: '"Flash" can\'t be a companion.' },
    ]);
  });

  it("flags a second companion", () => {
    expect(warnings("Companion\n1 Lurrus of the Dream-Den\nCompanion\n1 Zirda, the Dawnwaker")).toEqual([
      {
        code: "companion",
        message: 'Only one companion can be declared; using "Lurrus of the Dream-Den" and ignoring "Zirda, the Dawnwaker".',
      },
    ]);
  });

  it("flags a companion listed more than once", () => {
    expect(warnings("Companion\n2 Lurrus of the Dream-Den")).toEqual([
      { code: "companion", message: 'The companion "Lurrus of the Dream-Den" is listed 2 times; it counts as one card.' },
    ]);
  });

  it("does not warn about an eligible sideboard card that isn't the companion", () => {
    expect(warnings("1 Flash\nSideboard\n1 Lurrus of the Dream-Den")).toEqual([]);
  });
});
