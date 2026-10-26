import type { DecklistWarning } from "@/lib/decklist/types";

type WarningCode = DecklistWarning["code"];

// the short name shown on an entry's row
export const WARNING_LABELS: Record<WarningCode, string> = {
  points: "points",
  "deck-size": "deck size",
  "unknown-card": "card name",
  singleton: "duplicates",
  companion: "companion",
};

// "N entries with ...", in this order
export const WARNING_PROBLEMS: Record<WarningCode, string> = {
  points: "points issues",
  "deck-size": "deck size issues",
  singleton: "duplicate cards",
  "unknown-card": "unrecognised cards",
  companion: "companion issues",
};

export const WARNING_ORDER: WarningCode[] = ["points", "deck-size", "singleton", "unknown-card", "companion"];

export function warningLabel(warnings: DecklistWarning[]): string {
  return [...new Set(warnings.map((warning) => WARNING_LABELS[warning.code]))].join(", ");
}

// how many of the given entries have each kind of problem, for the kinds that occur
export function countEntriesByProblem(
  entryIds: string[],
  warningsByEntryId: Map<string, DecklistWarning[]>
): { code: WarningCode; problem: string; count: number }[] {
  return WARNING_ORDER.map((code) => ({
    code,
    problem: WARNING_PROBLEMS[code],
    count: entryIds.filter((id) => warningsByEntryId.get(id)?.some((w) => w.code === code)).length,
  })).filter((row) => row.count > 0);
}
