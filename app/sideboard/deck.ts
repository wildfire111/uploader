import { parseDecklist } from "@/lib/decklist/parse";
import type { Board } from "@/lib/decklist/types";

// one card in the grid; a card with several copies is several columns
export type Column = { id: string; name: string; board: Board };

// the id is the board, the name and which copy it is, so the same list always gives the same ids
export function columnsFromDecklist(raw: string): Column[] {
  const copies = new Map<string, number>();
  const columns: Column[] = [];
  for (const { name, quantity, board } of parseDecklist(raw)) {
    for (let copy = 0; copy < quantity; copy++) {
      const key = `${board}:${name}`;
      const count = copies.get(key) ?? 0;
      copies.set(key, count + 1);
      columns.push({ id: `${key}#${count}`, name, board });
    }
  }
  return columns;
}
