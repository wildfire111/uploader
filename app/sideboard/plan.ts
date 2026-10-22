import { columnsFromDecklist, type Column } from "./deck";

// a tick in a cell: in/out for the matchup, or the same when some condition the player knows applies
export type Cell = "in" | "maybe";

export type Matchup = {
  id: string;
  label: string;
  // by column id; an empty cell is absent
  cells: Record<string, Cell>;
};

export type Plan = {
  v: 1;
  deckText: string;
  // the sideboard first, then the maindeck, each in the order the player has put them
  columns: Column[];
  // maindeck column ids kept out of the grid; their ticks are kept
  hidden: string[];
  matchups: Matchup[];
  // width of a column in px
  size: number;
};

export const MIN_SIZE = 24;
export const MAX_SIZE = 96;
export const DEFAULT_SIZE = 44;

export function createPlan(): Plan {
  return {
    v: 1,
    deckText: "",
    columns: [],
    hidden: [],
    matchups: [],
    size: DEFAULT_SIZE,
  };
}

export function setSize(plan: Plan, size: number): Plan {
  return { ...plan, size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, size)) };
}

const BASIC_LAND_NAME =
  /^(snow-covered )?(plains|island|swamp|mountain|forest)$|^wastes$/i;

// the basics, which need no list to know
export function isBasicLand(name: string): boolean {
  return BASIC_LAND_NAME.test(name.trim());
}

// used for the first paste and for every update: cards that stay keep their ticks, order and
// hidden state, new cards go at the end of their group and cards that left take their ticks with them.
// A new maindeck card that `isLand` accepts starts hidden; ones the person has shown stay shown.
export function setDecklist(
  plan: Plan,
  deckText: string,
  isLand?: (name: string) => boolean,
): Plan {
  const fresh = columnsFromDecklist(deckText);
  const freshIds = new Set(fresh.map((column) => column.id));
  const freshById = new Map(fresh.map((column) => [column.id, column]));
  const kept = plan.columns.flatMap((column) => freshById.get(column.id) ?? []);
  const keptIds = new Set(kept.map((column) => column.id));
  const added = fresh.filter((column) => !keptIds.has(column.id));
  const group = (board: Column["board"]) => [
    ...kept.filter((column) => column.board === board),
    ...added.filter((column) => column.board === board),
  ];

  return {
    ...plan,
    deckText,
    columns: [...group("side"), ...group("main")],
    hidden: [
      ...plan.hidden.filter((id) => freshIds.has(id)),
      ...added
        .filter((column) => column.board === "main" && isLand?.(column.name))
        .map((column) => column.id),
    ],
    matchups: plan.matchups.map((matchup) => ({
      ...matchup,
      cells: Object.fromEntries(
        Object.entries(matchup.cells).filter(([id]) => freshIds.has(id)),
      ),
    })),
  };
}

// the column takes the place of the target, within its own group
export function moveColumn(plan: Plan, id: string, targetId: string): Plan {
  const from = plan.columns.findIndex((column) => column.id === id);
  const to = plan.columns.findIndex((column) => column.id === targetId);
  if (
    from < 0 ||
    to < 0 ||
    from === to ||
    plan.columns[from].board !== plan.columns[to].board
  ) {
    return plan;
  }
  const columns = [...plan.columns];
  const [moved] = columns.splice(from, 1);
  columns.splice(to, 0, moved);
  return { ...plan, columns };
}

export function hideColumn(plan: Plan, id: string): Plan {
  const column = plan.columns.find((candidate) => candidate.id === id);
  if (!column || column.board !== "main" || plan.hidden.includes(id)) {
    return plan;
  }
  return { ...plan, hidden: [...plan.hidden, id] };
}

export function showAllColumns(plan: Plan): Plan {
  return { ...plan, hidden: [] };
}

export function showColumn(plan: Plan, id: string): Plan {
  return { ...plan, hidden: plan.hidden.filter((hiddenId) => hiddenId !== id) };
}

// no label gives a blank row for the name to be typed into
export function addMatchup(
  plan: Plan,
  label = "",
  id = crypto.randomUUID(),
): Plan {
  return {
    ...plan,
    matchups: [...plan.matchups, { id, label: label.trim(), cells: {} }],
  };
}

function updateMatchup(
  plan: Plan,
  id: string,
  change: (matchup: Matchup) => Matchup,
): Plan {
  return {
    ...plan,
    matchups: plan.matchups.map((matchup) =>
      matchup.id === id ? change(matchup) : matchup,
    ),
  };
}

// a name can't be taken away: a blank one keeps the old name, and a new row that was never named goes
export function renameMatchup(plan: Plan, id: string, label: string): Plan {
  const trimmed = label.trim();
  if (trimmed === "") {
    return plan.matchups.some(
      (matchup) => matchup.id === id && matchup.label === "",
    )
      ? removeMatchup(plan, id)
      : plan;
  }
  return updateMatchup(plan, id, (matchup) => ({ ...matchup, label: trimmed }));
}

export function removeMatchup(plan: Plan, id: string): Plan {
  return {
    ...plan,
    matchups: plan.matchups.filter((matchup) => matchup.id !== id),
  };
}

// puts a removed matchup back, for the undo
export function insertMatchup(
  plan: Plan,
  matchup: Matchup,
  index: number,
): Plan {
  const matchups = [...plan.matchups];
  matchups.splice(index, 0, matchup);
  return { ...plan, matchups };
}

export function moveMatchup(plan: Plan, id: string, index: number): Plan {
  const from = plan.matchups.findIndex((matchup) => matchup.id === id);
  if (from < 0) {
    return plan;
  }
  const matchups = [...plan.matchups];
  const [moved] = matchups.splice(from, 1);
  matchups.splice(index, 0, moved);
  return { ...plan, matchups };
}

const NEXT_CELL: Record<Cell | "empty", Cell | "empty"> = {
  empty: "in",
  in: "maybe",
  maybe: "empty",
};

export function cycleCell(
  plan: Plan,
  matchupId: string,
  columnId: string,
): Plan {
  return updateMatchup(plan, matchupId, (matchup) => {
    const { [columnId]: current, ...rest } = matchup.cells;
    const next = NEXT_CELL[current ?? "empty"];
    return {
      ...matchup,
      cells: next === "empty" ? rest : { ...rest, [columnId]: next },
    };
  });
}
