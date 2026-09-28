import "server-only";
import { pool } from "../db";
import type { Entry } from "../types";

type EntryRow = {
  id: string;
  event_id: string;
  placing_from: number;
  placing_to: number | null;
  player_name: string;
  deck_name: string;
  decklist_raw: string;
  moxfield_deck_id: string | null;
  moxfield_pending_deck_id: string | null;
  publish_claimed_at: Date | null;
  created_at: Date;
};

function mapEntryRow(row: EntryRow): Entry {
  return {
    id: row.id,
    eventId: row.event_id,
    placingFrom: row.placing_from,
    placingTo: row.placing_to,
    playerName: row.player_name,
    deckName: row.deck_name,
    decklistRaw: row.decklist_raw,
    moxfieldDeckId: row.moxfield_deck_id,
    moxfieldPendingDeckId: row.moxfield_pending_deck_id,
    publishClaimedAt: row.publish_claimed_at ? row.publish_claimed_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getEntriesForEvent(eventId: string): Promise<Entry[]> {
  const result = await pool.query<EntryRow>(
    `select * from entries
     where event_id = $1
     order by placing_from asc, created_at asc`,
    [eventId]
  );
  return result.rows.map(mapEntryRow);
}

export async function getEntryById(id: string): Promise<Entry | null> {
  const result = await pool.query<EntryRow>(`select * from entries where id = $1`, [id]);
  const row = result.rows[0];
  return row ? mapEntryRow(row) : null;
}

export async function createEntry(input: {
  eventId: string;
  placingFrom: number;
  placingTo: number | null;
  playerName: string;
  deckName: string;
  decklistRaw: string;
}): Promise<Entry> {
  const result = await pool.query<EntryRow>(
    `insert into entries (event_id, placing_from, placing_to, player_name, deck_name, decklist_raw)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      input.eventId,
      input.placingFrom,
      input.placingTo,
      input.playerName,
      input.deckName,
      input.decklistRaw,
    ]
  );
  return mapEntryRow(result.rows[0]);
}

export async function updateEntry(
  id: string,
  input: {
    placingFrom: number;
    placingTo: number | null;
    playerName: string;
    deckName: string;
    decklistRaw: string;
  }
): Promise<Entry> {
  const result = await pool.query<EntryRow>(
    `update entries
     set placing_from = $2, placing_to = $3, player_name = $4, deck_name = $5, decklist_raw = $6
     where id = $1
     returning *`,
    [id, input.placingFrom, input.placingTo, input.playerName, input.deckName, input.decklistRaw]
  );
  return mapEntryRow(result.rows[0]);
}

export async function deleteEntry(id: string): Promise<void> {
  await pool.query(`delete from entries where id = $1`, [id]);
}
