import type { DecklistWarning } from "@/lib/decklist/types";

// one line per kind of problem, in this order, shown only when some entry has it
const SUMMARIES: { code: DecklistWarning["code"]; problem: string }[] = [
  { code: "points", problem: "points issues" },
  { code: "deck-size", problem: "deck size issues" },
  { code: "singleton", problem: "duplicate cards" },
  { code: "unknown-card", problem: "unrecognised cards" },
];

export function WarningSummary({
  warningsByEntryId,
}: {
  warningsByEntryId: Map<string, DecklistWarning[]>;
}) {
  const lists = [...warningsByEntryId.values()];
  return (
    <>
      {SUMMARIES.map(({ code, problem }) => {
        const count = lists.filter((warnings) => warnings.some((w) => w.code === code)).length;
        return count > 0 ? (
          <p key={code} className="warning">
            {count} {count === 1 ? "entry" : "entries"} with {problem}
          </p>
        ) : null;
      })}
    </>
  );
}
