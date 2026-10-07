import { describe, expect, it } from "vitest";
import { analyse, filler, index, knownCards, POINTS_FILE, reserved } from "./fixtures";
import { buildPointsIndex, parsePointsFile } from "./lists";
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
  describe("Lurrus in the sideboard", () => {
    // main: 7 points. sideboard: Lurrus (3 points when the companion) plus filler
    function lurrusDeck(mainPoints: string, side = "1 Lurrus of the Dream-Den", filler14 = 14): string {
      return `${mainPoints}\n${filler(56)}\n\nSideboard\n${side}\n${filler(filler14, "Side")}`;
    }
    // none of these are on the Reserved List
    const seven = "1 Thassa's Oracle\n1 Tamiyo, Inquisitive Student\n1 Card 1\n1 Card 2";
    const eight = "1 Thassa's Oracle\n1 Flash\n1 Card 1\n1 Card 2";
    const nine = "1 Thassa's Oracle\n1 Flash\n1 Lightning Bolt\n1 Card 1";

    it("allows 10 points with no reserved cards, because 7 without Lurrus", () => {
      const analysis = analyse(lurrusDeck(seven), index, reserved);
      expect(analysis.total).toBe(10);
      expect(analysis.totalWithoutLurrus).toBe(7);
      expect(check(analysis)).toEqual([]);
    });

    it("allows 11 points with no reserved cards, because 8 without Lurrus", () => {
      const analysis = analyse(lurrusDeck(eight), index, reserved);
      expect(analysis.total).toBe(11);
      expect(check(analysis)).toEqual([]);
    });

    it("allows a total that only fits with Lurrus counted as the companion", () => {
      // 5 + 3 = 8 with Lurrus, but 5 without: only the companion reading is valid
      const analysis = analyse(lurrusDeck("1 Thassa's Oracle\n1 Card 1\n1 Card 2\n1 Card 3"), index, reserved);
      expect(analysis.total).toBe(8);
      expect(analysis.totalWithoutLurrus).toBe(5);
      expect(check(analysis)).toEqual([]);
    });

    it("flags a total that fits neither way", () => {
      // 12 with Lurrus counted, 9 without: neither is 7 or 8
      const analysis = analyse(lurrusDeck(nine), index, reserved);
      expect(analysis.total).toBe(12);
      expect(analysis.totalWithoutLurrus).toBe(9);
      expect(check(analysis)).toEqual([
        {
          code: "points",
          message:
            "This list totals 12 points (9 without Lurrus as a companion); expected 7 or 8.",
        },
      ]);
    });

    it("uses the Reserved List limit for both totals", () => {
      // 8 without Lurrus, with a reserved card: the cap is 7, so 8 and 11 both fail
      const deck = lurrusDeck(`${eight}\n1 Taiga`);
      const analysis = analyse(deck, index, reserved);
      expect(analysis.totalWithoutLurrus).toBe(8);
      expect(check(analysis).map((w) => w.code)).toContain("points");
      // 10 with Lurrus, 7 without, with a reserved card: fine
      expect(
        check(analyse(lurrusDeck(`${seven}\n1 Taiga`), index, reserved)).some(
          (w) => w.code === "points"
        )
      ).toBe(false);
    });

    it("uses whatever Lurrus is currently worth on the points list", () => {
      const withValue = (points: number) =>
        buildPointsIndex(parsePointsFile(`${POINTS_FILE}\nLurrus of the Dream-Den ${points}`));
      // 2 points: 9 with Lurrus counted, 7 without; fits via the 7
      const two = analyse(lurrusDeck(seven), withValue(2), reserved);
      expect(two.total).toBe(9);
      expect(two.totalWithoutLurrus).toBe(7);
      expect(check(two)).toEqual([]);
      // 5 points: 12 with, 7 without
      const five = analyse(lurrusDeck(seven), withValue(5), reserved);
      expect(five.total).toBe(12);
      expect(check(five)).toEqual([]);
      // worth 0: no alternative is needed, the total is just the total
      const zero = analyse(lurrusDeck(seven), withValue(0), reserved);
      expect(zero.total).toBe(7);
      expect(zero.totalWithoutLurrus).toBeNull();
      expect(check(zero)).toEqual([]);
    });

    it("does nothing for Lurrus in the maindeck", () => {
      const main = `1 Ancestral Recall\n1 Tamiyo, Inquisitive Student\n1 Lurrus of the Dream-Den\n${filler(57)}\n\nSideboard\n${filler(15, "Side")}`;
      const analysis = analyse(main, index, reserved);
      expect(analysis.total).toBe(10);
      expect(analysis.totalWithoutLurrus).toBeNull();
      expect(check(analysis).map((w) => w.code)).toContain("points");
    });

    it("matches the name with a space instead of the hyphen, in any case", () => {
      const analysis = analyse(lurrusDeck(seven, "1 LURRUS OF THE DREAM DEN"), index, reserved);
      expect(analysis.totalWithoutLurrus).toBe(7);
    });

    it("has no alternative without a points list", () => {
      expect(analyse(lurrusDeck(seven), null, reserved).totalWithoutLurrus).toBeNull();
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
