import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { formatDeckDescription } from "@/lib/description";
import { formatDeckFolderName } from "@/lib/folderName";
import { getOrCreateFolderId, publishDeck } from "@/lib/moxfield";
import {
  MoxfieldContentError,
  MoxfieldRateLimitedError,
  MoxfieldReauthRequiredError,
  MoxfieldUserAgentMissingError,
} from "@/lib/moxfieldErrors";
import { getEntryById } from "@/lib/queries/entries";
import { getEventById, setEventMoxfieldFolderId } from "@/lib/queries/events";
import { formatDeckTitle } from "@/lib/title";

// the claim expiry below has to stay longer than this
export const maxDuration = 300;

function statusForError(error: unknown): number {
  if (error instanceof MoxfieldReauthRequiredError || error instanceof MoxfieldUserAgentMissingError) {
    return 503;
  }
  if (error instanceof MoxfieldContentError) {
    return 422;
  }
  if (error instanceof MoxfieldRateLimitedError) {
    return 429;
  }
  return 502;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(await headers());
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "You don't have permission to publish." }, { status: 403 });
  }

  const { id } = await params;
  const entry = await getEntryById(id);
  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  const event = await getEventById(entry.eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (event.status !== "submitted") {
    return NextResponse.json(
      { error: "This event is not submitted for review." },
      { status: 400 }
    );
  }

  if (entry.moxfieldDeckId !== null) {
    return NextResponse.json({ moxfieldDeckId: entry.moxfieldDeckId });
  }

  // claim in one statement so two publishes can't both hit moxfield
  const claim = await pool.query<{ id: string; moxfield_pending_deck_id: string | null }>(
    `update entries
     set publish_claimed_at = now()
     where id = $1
       and moxfield_deck_id is null
       and (publish_claimed_at is null or publish_claimed_at < now() - interval '10 minutes')
     returning id, moxfield_pending_deck_id`,
    [id]
  );

  if (claim.rowCount === 0) {
    const current = await getEntryById(id);
    if (current?.moxfieldDeckId) {
      return NextResponse.json({ moxfieldDeckId: current.moxfieldDeckId });
    }
    return NextResponse.json(
      { error: "This entry is already being published." },
      { status: 409 }
    );
  }

  try {
    const title = formatDeckTitle({
      placingFrom: entry.placingFrom,
      placingTo: entry.placingTo,
      playerName: entry.playerName,
      deckName: entry.deckName,
      eventName: event.name,
    });
    const folderId = await getOrCreateFolderId({
      folderId: event.moxfieldFolderId,
      folderName: formatDeckFolderName({ date: event.date, fullName: event.fullName }),
      onFolderCreated: (folderId) => setEventMoxfieldFolderId(event.id, folderId),
    });
    const moxfieldDeckId = await publishDeck({
      title,
      description: formatDeckDescription({
        date: event.date,
        fullName: event.fullName,
        attendance: event.attendance,
      }),
      decklist: entry.decklistRaw,
      folderId,
      pendingDeckId: claim.rows[0].moxfield_pending_deck_id,
      onDeckCreated: async (deckId) => {
        await pool.query(`update entries set moxfield_pending_deck_id = $2 where id = $1`, [
          id,
          deckId,
        ]);
      },
    });

    await pool.query(
      `update entries
       set moxfield_deck_id = $2, moxfield_pending_deck_id = null, publish_claimed_at = null
       where id = $1`,
      [id, moxfieldDeckId]
    );

    return NextResponse.json({ moxfieldDeckId });
  } catch (error) {
    await pool.query(`update entries set publish_claimed_at = null where id = $1`, [id]);
    const message = error instanceof Error ? error.message : "Could not publish this entry.";
    console.error(`Publish failed for entry ${id} (event ${event.id}): ${message}`);
    return NextResponse.json({ error: message }, { status: statusForError(error) });
  }
}
