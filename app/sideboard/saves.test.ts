import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlan, setDecklist } from "./plan";
import { addSave, findSave, matchesSave, parseSaves, readSaves, removeSave, serialiseSaves, writeSaves } from "./saves";
import { planToJson } from "./share";

const burn = setDecklist(createPlan(), "4 Lightning Bolt\n\nSideboard\n2 Pyroblast");
const delver = setDecklist(createPlan(), "4 Brainstorm");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("addSave", () => {
  it("keeps the newest first", () => {
    const saves = addSave(addSave([], "Burn", burn, 1), "Delver", delver, 2);
    expect(saves.map((save) => save.name)).toEqual(["Delver", "Burn"]);
  });

  it("replaces a save with the same name, ignoring case and spaces", () => {
    const saves = addSave(addSave([], "Burn", burn, 1), "  burn ", delver, 2);
    expect(saves).toHaveLength(1);
    expect(saves[0].name).toBe("burn");
    expect(saves[0].plan.deckText).toBe(delver.deckText);
  });
});

describe("removeSave and findSave", () => {
  it("find and remove by name", () => {
    const saves = addSave([], "Burn", burn, 1);
    expect(findSave(saves, "BURN")?.name).toBe("Burn");
    expect(removeSave(saves, "burn")).toEqual([]);
    expect(findSave(removeSave(saves, "burn"), "Burn")).toBeUndefined();
  });
});

describe("matchesSave", () => {
  it("is true for the plan that was saved and false once it is edited", () => {
    const saves = addSave([], "Burn", burn, 1);
    expect(matchesSave(saves, burn)).toBe(true);
    expect(matchesSave(saves, { ...burn, size: burn.size + 1 })).toBe(false);
    expect(matchesSave(saves, delver)).toBe(false);
  });

  it("is true for a plan loaded back from a save", () => {
    const saves = addSave([], "Burn", burn, 1);
    expect(matchesSave(saves, saves[0].plan)).toBe(true);
  });
});

describe("parseSaves", () => {
  it("round trips what serialiseSaves wrote", () => {
    const saves = addSave(addSave([], "Burn", burn, 1), "Delver", delver, 2);
    const back = parseSaves(serialiseSaves(saves));
    expect(back.map((save) => save.name)).toEqual(["Delver", "Burn"]);
    expect(planToJson(back[1].plan)).toBe(planToJson(burn));
  });

  it("returns nothing for missing or broken text", () => {
    expect(parseSaves(null)).toEqual([]);
    expect(parseSaves("not json")).toEqual([]);
    expect(parseSaves('{"a":1}')).toEqual([]);
  });

  it("leaves out entries that are not saved plans", () => {
    const good = { name: "Burn", savedAt: 1, plan: planToJson(burn) };
    const text = JSON.stringify([good, { name: "", savedAt: 2, plan: planToJson(burn) }, { name: "Bad", savedAt: 3, plan: "{}" }, 5, null]);
    expect(parseSaves(text).map((save) => save.name)).toEqual(["Burn"]);
  });
});

describe("storage", () => {
  it("writes and reads back through localStorage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    expect(writeSaves(addSave([], "Burn", burn, 1))).toBe(true);
    expect(readSaves().map((save) => save.name)).toEqual(["Burn"]);
  });

  it("reports a failed write and reads nothing when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    });
    expect(writeSaves(addSave([], "Burn", burn, 1))).toBe(false);
    expect(readSaves()).toEqual([]);
  });
});
