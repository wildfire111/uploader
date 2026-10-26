import "server-only";
import { pool } from "../db";
import type { AllowedUser, Event, EventDetailsInput, EventListItem, EventStatus } from "../types";

type EventRow = {
  id: string;
  name: string;
  full_name: string;
  date: string;
  attendance: number;
  status: EventStatus;
  created_by: string;
  created_at: Date;
  moxfield_folder_id: string | null;
  metadata_unlocked: boolean;
};

function mapEventRow(row: EventRow): Event {
  return {
    id: row.id,
    name: row.name,
    fullName: row.full_name,
    date: row.date,
    attendance: row.attendance,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    moxfieldFolderId: row.moxfield_folder_id,
    metadataUnlocked: row.metadata_unlocked,
  };
}

export async function getEventsForUser(user: AllowedUser): Promise<EventListItem[]> {
  const result = await pool.query<EventRow & { entry_count: string; published_count: string }>(
    `select e.*, count(en.id) as entry_count, count(en.moxfield_deck_id) as published_count
     from events e
     left join entries en on en.event_id = e.id
     where e.created_by = $1
        or ($2 and e.status in ('submitted', 'published'))
     group by e.id
     order by e.created_at desc`,
    [user.email, user.isAdmin]
  );

  return result.rows.map((row) => ({
    ...mapEventRow(row),
    entryCount: Number(row.entry_count),
    publishedCount: Number(row.published_count),
  }));
}

export async function getEventById(id: string): Promise<Event | null> {
  const result = await pool.query<EventRow>(`select * from events where id = $1`, [id]);
  const row = result.rows[0];
  return row ? mapEventRow(row) : null;
}

export async function createEvent(input: EventDetailsInput & { createdBy: string }): Promise<Event> {
  const result = await pool.query<EventRow>(
    `insert into events (name, full_name, date, attendance, created_by)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [input.name, input.fullName, input.date, input.attendance, input.createdBy]
  );
  return mapEventRow(result.rows[0]);
}

export type ImportedEntryInput = {
  playerName: string;
  deckName: string;
  decklistRaw: string;
};

// The event and all its lists go in together or not at all. Each list gets a placeholder placing in
// import order and is marked unplaced, so the real placings can be assigned afterwards.
export async function createEventWithImportedEntries(
  input: EventDetailsInput & { createdBy: string },
  entries: ImportedEntryInput[]
): Promise<Event> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const eventResult = await client.query<EventRow>(
      `insert into events (name, full_name, date, attendance, created_by)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [input.name, input.fullName, input.date, input.attendance, input.createdBy]
    );
    const event = eventResult.rows[0];
    if (entries.length > 0) {
      await client.query(
        `insert into entries (event_id, placing_from, placing_to, player_name, deck_name, decklist_raw, placing_assigned)
         select $1, t.placing_from, null, t.player_name, t.deck_name, t.decklist_raw, false
         from unnest($2::int[], $3::text[], $4::text[], $5::text[])
           as t(placing_from, player_name, deck_name, decklist_raw)`,
        [
          event.id,
          entries.map((_, index) => index + 1),
          entries.map((entry) => entry.playerName),
          entries.map((entry) => entry.deckName),
          entries.map((entry) => entry.decklistRaw),
        ]
      );
    }
    await client.query("commit");
    return mapEventRow(event);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEventDetails(id: string, input: EventDetailsInput): Promise<Event> {
  const result = await pool.query<EventRow>(
    `update events
     set name = $2, full_name = $3, date = $4, attendance = $5
     where id = $1
     returning *`,
    [id, input.name, input.fullName, input.date, input.attendance]
  );
  return mapEventRow(result.rows[0]);
}

export async function setEventStatus(id: string, status: EventStatus): Promise<Event> {
  const result = await pool.query<EventRow>(
    `update events set status = $2 where id = $1 returning *`,
    [id, status]
  );
  return mapEventRow(result.rows[0]);
}

// publishing locks the details again, and so does handing the event back to its creator
export async function setEventStatusAndRelock(id: string, status: EventStatus): Promise<Event> {
  const result = await pool.query<EventRow>(
    `update events set status = $2, metadata_unlocked = false where id = $1 returning *`,
    [id, status]
  );
  return mapEventRow(result.rows[0]);
}

export async function setMetadataUnlocked(id: string, unlocked: boolean): Promise<Event> {
  const result = await pool.query<EventRow>(
    `update events set metadata_unlocked = $2 where id = $1 returning *`,
    [id, unlocked]
  );
  return mapEventRow(result.rows[0]);
}

export async function setEventMoxfieldFolderId(id: string, folderId: string): Promise<void> {
  await pool.query(`update events set moxfield_folder_id = $2 where id = $1`, [id, folderId]);
}

export async function deleteEvent(id: string): Promise<void> {
  await pool.query(`delete from events where id = $1`, [id]);
}
