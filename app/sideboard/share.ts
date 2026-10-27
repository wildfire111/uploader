import { MAX_SIZE, MIN_SIZE, NOTE_MAX, setDecklist, type Cell, type Matchup, type Plan } from "./plan";

export type PlanResult = { ok: true; plan: Plan } | { ok: false; error: string };

const BAD_PLAN = "That isn't a sideboard plan.";

export function planToJson(plan: Plan): string {
  return JSON.stringify(plan);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function readMatchup(value: unknown): Matchup | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.label !== "string" || !isRecord(value.cells)) {
    return null;
  }
  const cells: Record<string, Cell> = {};
  for (const [id, cell] of Object.entries(value.cells)) {
    if (cell !== "in" && cell !== "maybe") {
      return null;
    }
    cells[id] = cell;
  }
  const note = typeof value.note === "string" ? value.note.trim().slice(0, NOTE_MAX) : "";
  return note === "" ? { id: value.id, label: value.label, cells } : { id: value.id, label: value.label, cells, note };
}

// checks a plan from outside (a file, a link or the browser's storage); the columns are rebuilt from
// the decklist, so ticks and hidden cards for columns that don't exist are dropped
export function parsePlan(text: string): PlanResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: BAD_PLAN };
  }
  if (!isRecord(value) || value.v !== 1) {
    return { ok: false, error: BAD_PLAN };
  }
  const { deckText, columns, hidden, matchups, size } = value;
  if (
    typeof deckText !== "string" ||
    !Array.isArray(columns) ||
    !columns.every((column) => isRecord(column) && typeof column.id === "string") ||
    !isStrings(hidden) ||
    !Array.isArray(matchups) ||
    typeof size !== "number" ||
    !Number.isFinite(size)
  ) {
    return { ok: false, error: BAD_PLAN };
  }
  const readMatchups = matchups.map(readMatchup);
  if (readMatchups.some((matchup) => matchup === null)) {
    return { ok: false, error: BAD_PLAN };
  }

  const plan = setDecklist(
    {
      v: 1,
      deckText,
      columns: columns as Plan["columns"],
      hidden,
      matchups: readMatchups as Matchup[],
      size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, size)),
    },
    deckText,
  );
  return { ok: true, plan };
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

// the plan as text that is safe in a URL fragment: deflated JSON, base64url
export async function encodeShare(plan: Plan): Promise<string> {
  const bytes = await pipe(new TextEncoder().encode(planToJson(plan)), new CompressionStream("deflate-raw"));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function decodeShare(text: string): Promise<PlanResult> {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) {
    return { ok: false, error: BAD_PLAN };
  }
  try {
    const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder("utf-8", { fatal: true }).decode(await pipe(bytes, new DecompressionStream("deflate-raw")));
    return parsePlan(json);
  } catch {
    return { ok: false, error: BAD_PLAN };
  }
}
