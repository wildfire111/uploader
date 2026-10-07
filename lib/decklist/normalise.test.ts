import { describe, expect, it } from "vitest";
import { cardFaces, frontFace, normaliseCardName } from "./normalise";

const GOLDEN: Array<[string, string]> = [
  ["Lightning Bolt", "lightning bolt"],
  ["  Lightning   Bolt  ", "lightning bolt"],
  ["Lurrus of the Dream-Den", "lurrus of the dream den"],
  ["Lurrus of the Dream Den", "lurrus of the dream den"],
  ["Thassa’s Oracle", "thassa's oracle"],
  ["Lim-Dûl's Vault", "lim dul's vault"],
  ["Fire // Ice", "fire // ice"],
  ["Fire/Ice", "fire // ice"],
  ["Fire//Ice", "fire // ice"],
  ["Fire  //  Ice", "fire // ice"],
  ["Delver of Secrets // Insectile Aberration", "delver of secrets // insectile aberration"],
  ["Summon: Choco/Mog", "summon: choco // mog"],
];

describe("normaliseCardName", () => {
  it("gives the expected key for each spelling", () => {
    for (const [input, expected] of GOLDEN) {
      expect(normaliseCardName(input)).toBe(expected);
    }
  });
});

describe("cardFaces and frontFace", () => {
  it("splits double-faced and split cards however they are spelt", () => {
    for (const spelling of ["Fire // Ice", "Fire/Ice", "Fire//Ice"]) {
      expect(cardFaces(spelling)).toEqual(["fire", "ice"]);
      expect(frontFace(spelling)).toBe("fire");
    }
  });

  it("gives a single-faced card as its only face", () => {
    expect(cardFaces("Lightning Bolt")).toEqual(["lightning bolt"]);
    expect(frontFace("Lightning Bolt")).toBe("lightning bolt");
  });
});
