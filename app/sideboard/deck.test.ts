import { describe, expect, it } from "vitest";
import { columnsFromDecklist } from "./deck";

describe("columnsFromDecklist", () => {
  it("makes one column per card, sideboard and maindeck marked", () => {
    const columns = columnsFromDecklist("1 Flash\n2 Island\n\nSideboard\n1 Lightning Bolt");
    expect(columns.map(({ name, board }) => [name, board])).toEqual([
      ["Flash", "main"],
      ["Island", "main"],
      ["Island", "main"],
      ["Lightning Bolt", "side"],
    ]);
  });

  it("gives every copy its own id so that ticks stay with a column", () => {
    const columns = columnsFromDecklist("2 Island\n1 Flash");
    expect(new Set(columns.map((column) => column.id)).size).toBe(3);
  });

  it("gives the same ids to the same cards however the list is ordered", () => {
    const first = columnsFromDecklist("2 Island\n1 Flash");
    const second = columnsFromDecklist("1 Flash\n2 Island");
    expect(new Set(first.map((column) => column.id))).toEqual(new Set(second.map((column) => column.id)));
  });

  it("keeps a card with the same name on both boards apart", () => {
    const columns = columnsFromDecklist("1 Island\nSideboard\n1 Island");
    expect(new Set(columns.map((column) => column.id)).size).toBe(2);
  });

  it("puts the companion in the sideboard", () => {
    const columns = columnsFromDecklist("Companion\n1 Lurrus of the Dream-Den\n1 Flash");
    expect(columns.map(({ name, board }) => [name, board])).toEqual([
      ["Lurrus of the Dream-Den", "side"],
      ["Flash", "main"],
    ]);
  });

  it("reads a list split by a blank line alone", () => {
    const columns = columnsFromDecklist("1 Flash\n\n1 Lightning Bolt");
    expect(columns.map((column) => column.board)).toEqual(["main", "side"]);
  });

  it("returns nothing for an empty paste", () => {
    expect(columnsFromDecklist("  \n")).toEqual([]);
  });
});
