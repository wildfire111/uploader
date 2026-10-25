import { describe, expect, it } from "vitest";
import { markDecklistLines } from "./analyse";
import { index, knownCards, aliasIndex } from "./fixtures";
import { classifyLines } from "./parse";
import type { CheckLists } from "./types";

const lists: CheckLists = { points: index, reserved: null, cardNames: knownCards, aliases: aliasIndex, companions: null };
const roles = (raw: string) => classifyLines(raw).map((line) => `${line.role}:${line.board}`);

describe("classifyLines", () => {
  it("gives one entry per line, whatever the line ending", () => {
    expect(classifyLines("1 Flash\r\n\r\nSideboard\r\n1 Island")).toHaveLength(4);
    expect(classifyLines("")).toHaveLength(1);
  });

  it("puts the divider on the Sideboard header", () => {
    expect(roles("1 Flash\nSideboard\n1 Island")).toEqual(["card:main", "divider:side", "card:side"]);
  });

  it("puts the divider on the first blank line when there is no header", () => {
    expect(roles("1 Flash\n\n\n1 Island")).toEqual(["card:main", "divider:side", "blank:side", "card:side"]);
  });

  it("does not split on a blank line when there is a header", () => {
    expect(roles("1 Flash\n\n1 Island\nSideboard\n1 Bolt")).toEqual([
      "card:main",
      "blank:main",
      "card:main",
      "divider:side",
      "card:side",
    ]);
  });

  it("puts an SB: card on the sideboard without a divider", () => {
    expect(roles("1 Flash\nSB: 1 Island")).toEqual(["card:main", "card:side"]);
  });

  it("has no divider without a sideboard", () => {
    expect(roles("1 Flash\n1 Island")).toEqual(["card:main", "card:main"]);
  });

  it("ignores other headers and section labels", () => {
    expect(roles("Deck\nCreatures\n2 Flash\n1 Island")).toEqual(["ignored:main", "ignored:main", "card:main", "card:main"]);
  });

  it("ignores the Companion marker and puts the card under it on the sideboard", () => {
    const lines = classifyLines("Companion\n1 Lurrus of the Dream-Den\n\n4 Flash");
    expect(lines.map((line) => `${line.role}:${line.board}`)).toEqual(["ignored:side", "card:side", "blank:main", "card:main"]);
    expect(lines.map((line) => line.companion)).toEqual([true, true, undefined, undefined]);
  });

  it("keeps a companion that is repeated in the sideboard as a card", () => {
    const lines = classifyLines("1 Flash\nSideboard\n1 Lurrus of the Dream-Den (Companion)\n1 Lurrus of the Dream-Den");
    expect(lines[3]).toMatchObject({ role: "card", board: "side" });
    expect(lines[3].card).toBeUndefined();
  });
});

describe("markDecklistLines", () => {
  it("flags an unknown card only once its line is finished", () => {
    expect(markDecklistLines("1 Flash\n1 Lightning Bo", lists).map((line) => line.unknown)).toEqual([undefined, undefined]);
    expect(markDecklistLines("1 Flash\n1 Lightning Bo\n", lists).map((line) => line.unknown)).toEqual([undefined, true, undefined]);
  });

  it("flags the final line once it is finished", () => {
    expect(markDecklistLines("1 Lightning Bo", lists, true)[0].unknown).toBe(true);
  });

  it("does not flag an unknown card without the card-name list", () => {
    const marked = markDecklistLines("1 Nonsense\n", { ...lists, cardNames: null });
    expect(marked.some((line) => line.unknown)).toBe(false);
  });

  it("does not flag a flavor name", () => {
    expect(markDecklistLines("1 Widow-Making Infiltrator\n", lists)[0].unknown).toBeUndefined();
  });

  it("flags every line of a repeated card, across both boards", () => {
    const marked = markDecklistLines("1 Flash\nSideboard\n1 Flash\n1 Island\n", lists);
    expect(marked.map((line) => line.repeated)).toEqual([true, undefined, true, undefined, undefined]);
  });

  it("flags a card repeated on one line, by front face, but not basic lands", () => {
    expect(markDecklistLines("2 Flash\n", lists)[0].repeated).toBe(true);
    expect(markDecklistLines("1 Fire // Ice\n1 Fire\n", lists).map((line) => line.repeated)).toEqual([true, true, undefined]);
    expect(markDecklistLines("20 Island\n", lists)[0].repeated).toBeUndefined();
  });

  it("gives the points for one copy, and nothing for a card with none", () => {
    expect(markDecklistLines("2 Flash\n1 Island\n", lists).map((line) => line.points)).toEqual([3, undefined, undefined]);
  });

  it("gives no points without a points list", () => {
    expect(markDecklistLines("1 Flash\n", { ...lists, points: null })[0].points).toBeUndefined();
  });
});
