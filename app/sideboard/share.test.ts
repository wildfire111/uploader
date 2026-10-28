import { describe, expect, it } from "vitest";
import {
  addMatchup,
  createPlan,
  cycleCell,
  hideColumn,
  moveColumn,
  setDecklist,
  setNote,
  NOTE_MAX,
  setSize,
  type Plan,
} from "./plan";
import { decodeShare, encodeShare, parsePlan, planToJson } from "./share";

function samplePlan(): Plan {
  let plan = setDecklist(createPlan(), "1 Flash\n1 Black Lotus\n2 Island\n\nSideboard\n1 Lightning Bolt\n1 Toxic Deluge");
  plan = addMatchup(addMatchup(plan, "Cradle"), "Oracle");
  plan = cycleCell(plan, plan.matchups[0].id, plan.columns[0].id);
  plan = cycleCell(cycleCell(plan, plan.matchups[1].id, plan.columns[2].id), plan.matchups[1].id, plan.columns[2].id);
  plan = moveColumn(plan, plan.columns[0].id, plan.columns[1].id);
  plan = hideColumn(plan, plan.columns[3].id);
  return setSize(plan, 60);
}

describe("planToJson and parsePlan", () => {
  it("round-trips a plan", () => {
    const plan = samplePlan();
    expect(parsePlan(planToJson(plan))).toEqual({ ok: true, plan });
  });

  it.each([
    ["text that is not JSON", "not json"],
    ["JSON that is not a plan", "[1,2]"],
    ["a plan of an unknown version", JSON.stringify({ ...createPlan(), v: 2 })],
    ["a missing matchup list", JSON.stringify({ ...createPlan(), matchups: undefined })],
    ["a matchup without a label", JSON.stringify({ ...createPlan(), matchups: [{ id: "a", cells: {} }] })],
    ["a cell that is not a tick", JSON.stringify({ ...createPlan(), matchups: [{ id: "a", label: "A", cells: { x: "yes" } }] })],
    ["a size that is not a number", JSON.stringify({ ...createPlan(), size: "wide" })],
  ])("rejects %s", (_, text) => {
    const result = parsePlan(text);
    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("error");
  });

  it("drops ticks and hidden cards that point at columns the decklist doesn't have", () => {
    const plan = samplePlan();
    const tampered = {
      ...plan,
      hidden: [...plan.hidden, "main:Nothing#0"],
      matchups: plan.matchups.map((matchup) => ({ ...matchup, cells: { ...matchup.cells, "main:Nothing#0": "in" } })),
    };
    expect(parsePlan(JSON.stringify(tampered))).toEqual({ ok: true, plan });
  });

  it("loads a plan saved with a deck name, without the name", () => {
    const result = parsePlan(JSON.stringify({ ...createPlan(), title: "Legacy Doomsday" }));
    expect(result.ok && result.plan).toEqual(createPlan());
  });

  it("keeps the size within what the grid can show", () => {
    const result = parsePlan(JSON.stringify({ ...createPlan(), size: 9999 }));
    expect(result).toMatchObject({ ok: true, plan: { size: 96 } });
  });
});

describe("encodeShare and decodeShare", () => {
  it("round-trips a plan through text that is safe in a URL", async () => {
    const plan = samplePlan();
    const text = await encodeShare(plan);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeShare(text)).toEqual({ ok: true, plan });
  });

  it("is smaller than the JSON for a real-sized plan", async () => {
    let plan = setDecklist(
      createPlan(),
      `${Array.from({ length: 60 }, (_, i) => `1 Maindeck Card Number ${i}`).join("\n")}\nSideboard\n${Array.from({ length: 15 }, (_, i) => `1 Sideboard Card ${i}`).join("\n")}`,
    );
    for (let i = 0; i < 18; i++) {
      plan = addMatchup(plan, `Matchup ${i}`);
    }
    expect((await encodeShare(plan)).length).toBeLessThan(planToJson(plan).length / 2);
  });

  it.each(["", "!!!", "AAAA", "eyJ2IjoxfQ"])("rejects a link that isn't a plan: %j", async (text) => {
    const result = await decodeShare(text);
    expect(result.ok).toBe(false);
  });
});

describe("notes", () => {
  it("round-trips a note", async () => {
    const base = samplePlan();
    const plan = setNote(base, base.matchups[0].id, "side in Bolt");
    expect(parsePlan(planToJson(plan))).toEqual({ ok: true, plan });
    expect(await decodeShare(await encodeShare(plan))).toEqual({ ok: true, plan });
  });

  it("loads a plan saved before notes existed", () => {
    const result = parsePlan(planToJson(samplePlan()));
    expect(result.ok && result.plan.matchups.every((matchup) => !("note" in matchup))).toBe(true);
  });

  it("trims an over-long or blank note from outside", () => {
    const plan = samplePlan();
    const raw = JSON.parse(planToJson(plan));
    raw.matchups[0].note = "a".repeat(NOTE_MAX + 10);
    raw.matchups[1].note = "   ";
    const result = parsePlan(JSON.stringify(raw));
    expect(result.ok && result.plan.matchups[0].note).toHaveLength(NOTE_MAX);
    expect(result.ok && "note" in result.plan.matchups[1]).toBe(false);
  });
});
