import "server-only";
import { pool } from "../db";
import type { Entry, EntryInput } from "../types";

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
  placing_assigned: boolean;
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
    placingAssigned: row.placing_assigned,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getEntriesForEvent(eventId: string): Promise<Entry[]> {
  const result = await pool.query<EntryRow>(
    `select * from entries
     where event_id = $1
     order by placing_assigned desc, placing_from asc, created_at asc`,
    [eventId]
  );
  return result.rows.map(mapEntryRow);
}

export async function getEntryById(id: string): Promise<Entry | null> {
  const result = await pool.query<EntryRow>(`select * from entries where id = $1`, [id]);
  const row = result.rows[0];
  return row ? mapEntryRow(row) : null;
}

export async function createEntry(input: EntryInput & { eventId: string }): Promise<Entry> {
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

// Gives an imported list its real placing, or (with placing null) takes it back to unplaced. The
// placeholder stays in placing_from, so an undone assignment goes back to where it sat in the import.
export async function assignPlacing(
  id: string,
  placing: { placingFrom: number; placingTo: number | null } | null,
  placeholder?: number
): Promise<Entry> {
  const result = placing
    ? await pool.query<EntryRow>(
        `update entries
         set placing_from = $2, placing_to = $3, placing_assigned = true
         where id = $1
         returning *`,
        [id, placing.placingFrom, placing.placingTo]
      )
    : await pool.query<EntryRow>(
        `update entries
         set placing_from = $2, placing_to = null, placing_assigned = false
         where id = $1
         returning *`,
        [id, placeholder ?? 1]
      );
  return mapEntryRow(result.rows[0]);
}

export async function updateEntry(
  id: string,
  input: EntryInput,
  placingAssigned: boolean
): Promise<Entry> {
  const result = await pool.query<EntryRow>(
    `update entries
     set placing_from = $2, placing_to = $3, player_name = $4, deck_name = $5, decklist_raw = $6,
         placing_assigned = $7
     where id = $1
     returning *`,
    [
      id,
      input.placingFrom,
      input.placingTo,
      input.playerName,
      input.deckName,
      input.decklistRaw,
      placingAssigned,
    ]
  );
  return mapEntryRow(result.rows[0]);
}

export async function deleteEntry(id: string): Promise<void> {
  await pool.query(`delete from entries where id = $1`, [id]);
}

// A publish claim older than this is treated as abandoned. It must outlast the longest a publish
// can run, which is the `maxDuration` of app/api/entries/[id]/publish/route.ts (300 seconds).
export const PUBLISH_CLAIM_MINUTES = 10;

// Claims the entry for publishing in one statement, so two publishes can't both reach Moxfield.
// Returns null when it is already published or someone else holds a live claim.
export async function claimEntryForPublish(
  id: string
): Promise<{ pendingDeckId: string | null } | null> {
  const result = await pool.query<{ moxfield_pending_deck_id: string | null }>(
    `update entries
     set publish_claimed_at = now()
     where id = $1
       and moxfield_deck_id is null
       and (publish_claimed_at is null or publish_claimed_at < now() - make_interval(mins => $2::int))
     returning moxfield_pending_deck_id`,
    [id, PUBLISH_CLAIM_MINUTES]
  );
  const row = result.rows[0];
  return row ? { pendingDeckId: row.moxfield_pending_deck_id } : null;
}

// a deck Moxfield created but couldn't fill, kept so a retry can delete it first
export async function setPendingDeckId(id: string, deckId: string): Promise<void> {
  await pool.query(`update entries set moxfield_pending_deck_id = $2 where id = $1`, [id, deckId]);
}

export async function markEntryPublished(id: string, deckId: string): Promise<void> {
  await pool.query(
    `update entries
     set moxfield_deck_id = $2, moxfield_pending_deck_id = null, publish_claimed_at = null
     where id = $1`,
    [id, deckId]
  );
}

export async function releasePublishClaim(id: string): Promise<void> {
  await pool.query(`update entries set publish_claimed_at = null where id = $1`, [id]);
}
