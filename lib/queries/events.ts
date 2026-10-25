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
