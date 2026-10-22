import { describe, expect, it } from "vitest";
import { checkTitleLength, formatDeckTitle } from "./title";

describe("formatDeckTitle", () => {
  it("formats the worked example", () => {
    const title = formatDeckTitle({
      placingFrom: 1,
      placingTo: 4,
      playerName: "Anthony P",
      deckName: "Gluten Free Storm",
      eventName: "GGGongIQ26",
      attendance: 22,
    });
    expect(title).toBe("01st/04th Anthony P - Gluten Free Storm - GGGongIQ26");
  });

  it("formats a single placing", () => {
    const title = formatDeckTitle({
      placingFrom: 1,
      placingTo: null,
      playerName: "Anthony P",
      deckName: "Gluten Free Storm",
      eventName: "GGGongIQ26",
      attendance: 22,
    });
    expect(title).toBe("01st Anthony P - Gluten Free Storm - GGGongIQ26");
  });

  it("formats a shared range", () => {
    const title = formatDeckTitle({
      placingFrom: 5,
      placingTo: 8,
      playerName: "Sam L",
      deckName: "Mono Red",
      eventName: "MelbWeekly38",
      attendance: 22,
    });
    expect(title).toBe("05th/08th Sam L - Mono Red - MelbWeekly38");
  });

  it("zero-pads double-digit ordinals", () => {
    const title = formatDeckTitle({
      placingFrom: 11,
      placingTo: null,
      playerName: "Priya R",
      deckName: "Burn",
      eventName: "GGGongIQ26",
      attendance: 22,
    });
    expect(title).toBe("11th Priya R - Burn - GGGongIQ26");
  });

  it("pads placings to the width of the attendance", () => {
    const title = formatDeckTitle({
      placingFrom: 3,
      placingTo: 4,
      playerName: "Priya R",
      deckName: "Burn",
      eventName: "GGGongIQ26",
      attendance: 1200,
    });
    expect(title).toBe("0003rd/0004th Priya R - Burn - GGGongIQ26");
  });
});

describe("checkTitleLength", () => {
  it("accepts exactly 100 characters", () => {
    expect(checkTitleLength("x".repeat(100))).toBeNull();
  });

  it("refuses 101 characters and says how far over", () => {
    expect(checkTitleLength("x".repeat(101))).toMatch(/1 character over.*101 characters/);
  });

  it("uses the plural when more than one character over", () => {
    expect(checkTitleLength("x".repeat(112))).toMatch(/12 characters over/);
  });

  it("accepts 2 characters and refuses fewer", () => {
    expect(checkTitleLength("ab")).toBeNull();
    expect(checkTitleLength("a")).toMatch(/at least 2/);
    expect(checkTitleLength("")).toMatch(/at least 2/);
  });

  it("accepts the worked example", () => {
    expect(checkTitleLength("01st/04th Anthony P - Gluten Free Storm - GGGongIQ26")).toBeNull();
  });
});
