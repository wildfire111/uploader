import { parsePlan, planToJson } from "./share";
import type { Plan } from "./plan";

export const SAVES_KEY = "sideboard-saves";

// `json` is the plan as it was saved; `plan` is that text read back through parsePlan
export type SavedPlan = { name: string; savedAt: number; json: string; plan: Plan };

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// newest first; anything in the stored text that isn't a saved plan is left out
export function parseSaves(text: string | null): SavedPlan[] {
  if (text === null) {
    return [];
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const saves: SavedPlan[] = [];
  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof item.name !== "string" ||
      item.name.trim() === "" ||
      typeof item.savedAt !== "number" ||
      typeof item.plan !== "string"
    ) {
      continue;
    }
    const result = parsePlan(item.plan);
    if (result.ok) {
      saves.push({ name: item.name, savedAt: item.savedAt, json: item.plan, plan: result.plan });
    }
  }
  return saves.sort((a, b) => b.savedAt - a.savedAt);
}

export function serialiseSaves(saves: SavedPlan[]): string {
  return JSON.stringify(saves.map(({ name, savedAt, json }) => ({ name, savedAt, plan: json })));
}

export function findSave(saves: SavedPlan[], name: string): SavedPlan | undefined {
  return saves.find((save) => sameName(save.name, name));
}

// saving under a name that is already there replaces that save
export function addSave(saves: SavedPlan[], name: string, plan: Plan, now: number): SavedPlan[] {
  const added: SavedPlan = { name: name.trim(), savedAt: now, json: planToJson(plan), plan };
  return [added, ...saves.filter((save) => !sameName(save.name, name))];
}

export function removeSave(saves: SavedPlan[], name: string): SavedPlan[] {
  return saves.filter((save) => !sameName(save.name, name));
}

// whether some save already holds this plan, so replacing it loses nothing
export function matchesSave(saves: SavedPlan[], plan: Plan): boolean {
  const json = planToJson(plan);
  return saves.some((save) => save.json === json || planToJson(save.plan) === json);
}

export function readSaves(): SavedPlan[] {
  try {
    return parseSaves(localStorage.getItem(SAVES_KEY));
  } catch {
    return [];
  }
}

// false when the browser wouldn't store it (blocked storage, or no room left)
export function writeSaves(saves: SavedPlan[]): boolean {
  try {
    localStorage.setItem(SAVES_KEY, serialiseSaves(saves));
    return true;
  } catch {
    return false;
  }
}
