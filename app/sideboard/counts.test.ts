import { describe, expect, it } from "vitest";
import { countMatchup, printColumns } from "./counts";
import { addMatchup, createPlan, cycleCell, hideColumn, setDecklist, type Plan } from "./plan";

const DECK = "1 Flash\n1 Black Lotus\n1 Ponder\n\nSideboard\n1 Lightning Bolt\n1 Toxic Deluge";

function tick(plan: Plan, columnName: string, times = 1): Plan {
  const column = plan.columns.find((candidate) => candidate.name === columnName)!;
  let next = plan;
  for (let i = 0; i < times; i++) {
    next = cycleCell(next, plan.matchups[0].id, column.id);
  }
  return next;
}

function planWithMatchup(): Plan {
  return addMatchup(setDecklist(createPlan(), DECK), "Cradle");
}

describe("countMatchup", () => {
  it("counts sideboard ticks as in and maindeck ticks as out", () => {
    let plan = planWithMatchup();
    plan = tick(tick(tick(plan, "Lightning Bolt"), "Toxic Deluge"), "Flash");
    expect(countMatchup(plan, plan.matchups[0])).toEqual({ in: 2, out: 1, balanced: false });
  });

  it("counts a conditional tick like any other", () => {
    let plan = planWithMatchup();
    plan = tick(tick(plan, "Lightning Bolt", 2), "Flash");
    expect(countMatchup(plan, plan.matchups[0])).toEqual({ in: 1, out: 1, balanced: true });
  });

  it("does not count a hidden column", () => {
    let plan = planWithMatchup();
    plan = tick(tick(plan, "Lightning Bolt"), "Flash");
    plan = hideColumn(plan, plan.columns.find((column) => column.name === "Flash")!.id);
    expect(countMatchup(plan, plan.matchups[0])).toEqual({ in: 1, out: 0, balanced: false });
  });

  it("is balanced when nothing is ticked", () => {
    const plan = planWithMatchup();
    expect(countMatchup(plan, plan.matchups[0])).toEqual({ in: 0, out: 0, balanced: true });
  });
});

describe("printColumns", () => {
  it("keeps every sideboard card and only the maindeck cards that are ticked and not hidden", () => {
    let plan = planWithMatchup();
    plan = tick(tick(tick(plan, "Flash"), "Black Lotus"), "Lightning Bolt");
    plan = hideColumn(plan, plan.columns.find((column) => column.name === "Black Lotus")!.id);
    expect(printColumns(plan).map((column) => column.name)).toEqual(["Lightning Bolt", "Toxic Deluge", "Flash"]);
  });

  it("drops every maindeck card when nothing is ticked", () => {
    expect(printColumns(planWithMatchup()).map((column) => column.board)).toEqual(["side", "side"]);
  });
});
