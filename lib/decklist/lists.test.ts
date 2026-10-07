import { describe, expect, it } from "vitest";
import { index, POINTS_FILE } from "./fixtures";
import { buildCardNameSet, parsePointsFile } from "./lists";

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
