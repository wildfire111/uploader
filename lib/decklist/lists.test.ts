import { describe, expect, it } from "vitest";
import { index, POINTS_FILE } from "./fixtures";
import { buildAliasIndex, buildCardNameSet, collectAliases, parsePointsFile, resolveAlias } from "./lists";

describe("parsePointsFile", () => {
  it("reads the points after the last space", () => {
    expect(parsePointsFile(POINTS_FILE)).toMatchObject({
      "Ancestral Recall": 5,
      "Tamiyo, Inquisitive Student // Tamiyo, Seasoned Scholar": 2,
    });
  });

  it("skips blank, single-word and non-numeric lines, and handles CRLF", () => {
    expect(parsePointsFile("Flash 3\r\n\r\nNonsense\r\nLightning Bolt many\r\nBolt 1\r\n")).toEqual({
      Flash: 3,
      Bolt: 1,
    });
  });
});

describe("buildPointsIndex", () => {
  it("finds a double-faced card by full name or either face", () => {
    expect(index.get("tamiyo, inquisitive student // tamiyo, seasoned scholar")).toBe(2);
    expect(index.get("tamiyo, inquisitive student")).toBe(2);
    expect(index.get("tamiyo, seasoned scholar")).toBe(2);
  });
});

describe("buildCardNameSet", () => {
  const names = buildCardNameSet(["Lim-Dûl's Vault", "Delver of Secrets // Insectile Aberration"]);

  it("holds each whole name, normalised", () => {
    expect(names.has("lim dul's vault")).toBe(true);
    expect(names.has("delver of secrets // insectile aberration")).toBe(true);
  });

  it("accepts a front face but not a back face on its own", () => {
    expect(names.has("delver of secrets")).toBe(true);
    expect(names.has("insectile aberration")).toBe(false);
  });
});

describe("collectAliases", () => {
  it("reads flavor names, from the card and from each face", () => {
    expect(
      collectAliases([
        { name: "Dauthi Voidwalker", flavor_name: "Widow-Making Infiltrator" },
        { name: "Front // Back", card_faces: [{ flavor_name: "Front Alias" }, { flavor_name: "Back Alias" }] },
      ])
    ).toEqual({
      "Widow-Making Infiltrator": "Dauthi Voidwalker",
      "Front Alias": "Front // Back",
      "Back Alias": "Front // Back",
    });
  });

  // Scryfall keeps some Secret Lair and Marvel names as the printed name, not a flavor name
  it("reads printed names that differ from the card's name", () => {
    const aliases = collectAliases([
      { name: "Malik, Grim Manipulator", printed_name: "Negan, the Cold-Blooded" },
      { name: "Spider-Woman, Stunning Savior", printed_name: "Makdee and Itla, Skysnarers" },
    ]);
    const index = buildAliasIndex(aliases);
    expect(resolveAlias(index, "Negan, the Cold-Blooded")).toBe("Malik, Grim Manipulator");
    expect(resolveAlias(index, "makdee and itla, skysnarers")).toBe("Spider-Woman, Stunning Savior");
  });

  it("ignores a printed name that is the card's name apart from case or accents", () => {
    expect(
      collectAliases([
        { name: "Anger", printed_name: "ANGER" },
        { name: "Lim-Dûl's Vault", printed_name: "Lim-Dul's Vault" },
        { name: "Flash", printed_name: "Flash" },
      ])
    ).toEqual({});
  });

  it("skips cards without a usable name", () => {
    expect(collectAliases([{ name: "Flash", flavor_name: 3, printed_name: null }])).toEqual({});
  });
});
