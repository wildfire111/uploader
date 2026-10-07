import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEntriesForEvent } from "@/lib/queries/entries";
import { getEventById, setEventStatus } from "@/lib/queries/events";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "You don't have permission to publish." }, { status: 403 });
  }

  const { id } = await params;
  const event = await getEventById(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (event.status !== "submitted") {
    return NextResponse.json(
      { error: "This event is not submitted for review." },
      { status: 400 }
    );
  }

  const entries = await getEntriesForEvent(id);
  const missing = entries.filter((entry) => entry.moxfieldDeckId === null);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `${missing.length} ${missing.length === 1 ? "entry" : "entries"} still need to be published.`,
      },
      { status: 400 }
    );
  }

  const updated = await setEventStatus(id, "published");
  return NextResponse.json({ event: updated });
}
