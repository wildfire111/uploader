import { describe, expect, it } from "vitest";
import {
  addMatchup,
  createPlan,
  cycleCell,
  hideColumn,
  insertMatchup,
  moveColumn,
  moveMatchup,
  removeMatchup,
  renameMatchup,
  setDecklist,
  setSize,
  showAllColumns,
  type Plan,
} from "./plan";

const DECK = "1 Flash\n1 Black Lotus\n2 Island\n\nSideboard\n1 Lightning Bolt\n1 Toxic Deluge";

function planWithDeck(): Plan {
  return setDecklist(createPlan(), DECK);
}

function ids(plan: Plan, board: "main" | "side"): string[] {
  return plan.columns.filter((column) => column.board === board).map((column) => column.id);
}

function names(plan: Plan): string[] {
  return plan.columns.map((column) => column.name);
}

describe("createPlan", () => {
  it("starts empty", () => {
    expect(createPlan()).toMatchObject({ v: 1, title: "", deckText: "", columns: [], hidden: [], matchups: [] });
  });
});

describe("matchups", () => {
  it("adds a trimmed label", () => {
    const plan = addMatchup(createPlan(), "  Cradle ");
    expect(plan.matchups.map((matchup) => matchup.label)).toEqual(["Cradle"]);
  });

  it("adds a row with a blank name to be typed into", () => {
    const plan = addMatchup(addMatchup(createPlan(), "Cradle"));
    expect(plan.matchups.map((matchup) => matchup.label)).toEqual(["Cradle", ""]);
  });

  it("removes a new row that is named nothing", () => {
    const plan = addMatchup(addMatchup(createPlan(), "Cradle"));
    expect(renameMatchup(plan, plan.matchups[1].id, "  ").matchups.map((matchup) => matchup.label)).toEqual(["Cradle"]);
  });

  it("names a new row", () => {
    const plan = addMatchup(createPlan());
    expect(renameMatchup(plan, plan.matchups[0].id, " Oracle ").matchups[0].label).toBe("Oracle");
  });

  it("gives each matchup its own id", () => {
    const plan = addMatchup(addMatchup(createPlan(), "A"), "A");
    expect(plan.matchups[0].id).not.toBe(plan.matchups[1].id);
  });

  it("renames a matchup", () => {
    const plan = addMatchup(createPlan(), "Cradle");
    expect(renameMatchup(plan, plan.matchups[0].id, "Oracle").matchups[0].label).toBe("Oracle");
  });

  it("has nothing but a label and its ticks", () => {
    expect(Object.keys(addMatchup(createPlan(), "Cradle").matchups[0]).sort()).toEqual(["cells", "id", "label"]);
  });

  it("keeps the old label when renamed to nothing", () => {
    const plan = addMatchup(createPlan(), "Cradle");
    expect(renameMatchup(plan, plan.matchups[0].id, "  ").matchups[0].label).toBe("Cradle");
  });

  it("moves a matchup to a position", () => {
    let plan = createPlan();
    for (const label of ["A", "B", "C"]) {
      plan = addMatchup(plan, label);
    }
    const [a, , c] = plan.matchups;
    expect(moveMatchup(plan, c.id, 0).matchups.map((matchup) => matchup.label)).toEqual(["C", "A", "B"]);
    expect(moveMatchup(plan, a.id, 2).matchups.map((matchup) => matchup.label)).toEqual(["B", "C", "A"]);
  });

  it("removes a matchup and puts it back where it was", () => {
    let plan = createPlan();
    for (const label of ["A", "B", "C"]) {
      plan = addMatchup(plan, label);
    }
    const removed = plan.matchups[1];
    const without = removeMatchup(plan, removed.id);
    expect(without.matchups.map((matchup) => matchup.label)).toEqual(["A", "C"]);
    expect(insertMatchup(without, removed, 1)).toEqual(plan);
  });
});

describe("cycleCell", () => {
  it("goes empty, tick, conditional, empty", () => {
    let plan = addMatchup(planWithDeck(), "Cradle");
    const matchupId = plan.matchups[0].id;
    const columnId = plan.columns[0].id;
    const cell = () => plan.matchups[0].cells[columnId];
    expect(cell()).toBeUndefined();
    plan = cycleCell(plan, matchupId, columnId);
    expect(cell()).toBe("in");
    plan = cycleCell(plan, matchupId, columnId);
    expect(cell()).toBe("maybe");
    plan = cycleCell(plan, matchupId, columnId);
    expect(cell()).toBeUndefined();
    expect(plan.matchups[0].cells).toEqual({});
  });

  it("leaves the other matchups alone", () => {
    let plan = addMatchup(addMatchup(planWithDeck(), "A"), "B");
    plan = cycleCell(plan, plan.matchups[0].id, plan.columns[0].id);
    expect(plan.matchups[1].cells).toEqual({});
  });
});

describe("setDecklist", () => {
  it("lays out the sideboard before the maindeck", () => {
    expect(names(planWithDeck())).toEqual(["Lightning Bolt", "Toxic Deluge", "Flash", "Black Lotus", "Island", "Island"]);
  });

  it("keeps ticks, order and hidden state of cards that stay, and appends new cards to their group", () => {
    let plan = addMatchup(planWithDeck(), "Cradle");
    const matchupId = plan.matchups[0].id;
    const [bolt, deluge, flash, lotus] = plan.columns;
    plan = cycleCell(plan, matchupId, bolt.id);
    plan = cycleCell(plan, matchupId, lotus.id);
    plan = moveColumn(plan, deluge.id, bolt.id);
    plan = hideColumn(plan, flash.id);

    const updated = setDecklist(plan, "1 Flash\n1 Black Lotus\n2 Island\n1 Ponder\n\nSideboard\n1 Lightning Bolt\n1 Toxic Deluge\n1 Force of Will");
    expect(names(updated)).toEqual([
      "Toxic Deluge",
      "Lightning Bolt",
      "Force of Will",
      "Flash",
      "Black Lotus",
      "Island",
      "Island",
      "Ponder",
    ]);
    expect(updated.matchups[0].cells).toEqual({ [bolt.id]: "in", [lotus.id]: "in" });
    expect(updated.hidden).toEqual([flash.id]);
  });

  it("drops the ticks and hidden state of cards that left the list", () => {
    let plan = addMatchup(planWithDeck(), "Cradle");
    const flash = plan.columns[2];
    plan = hideColumn(cycleCell(plan, plan.matchups[0].id, flash.id), flash.id);
    const updated = setDecklist(plan, "1 Black Lotus\n\nSideboard\n1 Lightning Bolt");
    expect(updated.matchups[0].cells).toEqual({});
    expect(updated.hidden).toEqual([]);
  });

  it("drops the later copy when a card with several copies loses one", () => {
    let plan = addMatchup(planWithDeck(), "Cradle");
    const [first, second] = plan.columns.filter((column) => column.name === "Island");
    plan = cycleCell(cycleCell(plan, plan.matchups[0].id, first.id), plan.matchups[0].id, second.id);
    const updated = setDecklist(plan, "1 Island\nSideboard\n1 Lightning Bolt");
    expect(updated.matchups[0].cells).toEqual({ [first.id]: "in" });
  });

  it("remembers the text for editing later", () => {
    expect(planWithDeck().deckText).toBe(DECK);
  });
});

describe("moveColumn", () => {
  it("puts the column where the target is, within its own group", () => {
    const plan = planWithDeck();
    const [flash, lotus, island1] = ids(plan, "main");
    expect(ids(moveColumn(plan, island1, flash), "main").slice(0, 3)).toEqual([island1, flash, lotus]);
    expect(ids(moveColumn(plan, flash, island1), "main").slice(0, 3)).toEqual([lotus, island1, flash]);
  });

  it("ignores a move across the divider", () => {
    const plan = planWithDeck();
    expect(moveColumn(plan, ids(plan, "main")[0], ids(plan, "side")[0])).toEqual(plan);
  });

  it("keeps the ticks with the column", () => {
    let plan = addMatchup(planWithDeck(), "Cradle");
    const [flash, , island1] = ids(plan, "main");
    plan = cycleCell(plan, plan.matchups[0].id, flash);
    plan = moveColumn(plan, flash, island1);
    expect(plan.matchups[0].cells).toEqual({ [flash]: "in" });
  });
});

describe("hiding", () => {
  it("hides a maindeck column and shows them all again", () => {
    let plan = planWithDeck();
    const [flash, lotus] = ids(plan, "main");
    plan = hideColumn(hideColumn(plan, flash), lotus);
    expect(plan.hidden).toEqual([flash, lotus]);
    expect(showAllColumns(plan).hidden).toEqual([]);
  });

  it("keeps the ticks of a hidden column", () => {
    let plan = addMatchup(planWithDeck(), "Cradle");
    const flash = ids(plan, "main")[0];
    plan = hideColumn(cycleCell(plan, plan.matchups[0].id, flash), flash);
    expect(plan.matchups[0].cells).toEqual({ [flash]: "in" });
  });

  it("does not hide a sideboard card", () => {
    const plan = planWithDeck();
    expect(hideColumn(plan, ids(plan, "side")[0]).hidden).toEqual([]);
  });

  it("does not hide the same column twice", () => {
    const plan = planWithDeck();
    const flash = ids(plan, "main")[0];
    expect(hideColumn(hideColumn(plan, flash), flash).hidden).toEqual([flash]);
  });
});

describe("setSize", () => {
  it("keeps the column size within what the grid can show", () => {
    expect(setSize(createPlan(), 5).size).toBe(24);
    expect(setSize(createPlan(), 500).size).toBe(96);
    expect(setSize(createPlan(), 50).size).toBe(50);
  });
});
