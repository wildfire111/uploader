import type { Column } from "./deck";
import type { Matchup, Plan } from "./plan";

export type MatchupCount = { in: number; out: number; balanced: boolean };

// sideboard ticks come in and maindeck ticks come out; hidden columns don't count
export function countMatchup(plan: Plan, matchup: Matchup): MatchupCount {
  const hidden = new Set(plan.hidden);
  let ins = 0;
  let outs = 0;
  for (const column of plan.columns) {
    if (!matchup.cells[column.id] || hidden.has(column.id)) {
      continue;
    }
    if (column.board === "side") {
      ins++;
    } else {
      outs++;
    }
  }
  return { in: ins, out: outs, balanced: ins === outs };
}

// the columns on paper: every sideboard card, and the maindeck cards that are shown and ticked somewhere
export function printColumns(plan: Plan): Column[] {
  const hidden = new Set(plan.hidden);
  const used = new Set(plan.matchups.flatMap((matchup) => Object.keys(matchup.cells)));
  return plan.columns.filter((column) => column.board === "side" || (used.has(column.id) && !hidden.has(column.id)));
}
