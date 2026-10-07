import { notFound } from "next/navigation";
import { after } from "next/server";
import { requireUser } from "@/lib/guards";
import { getStoredMoxfieldUsername } from "@/lib/moxfieldAuth";
import { cardNamesList, pointsList, reservedList } from "@/lib/referenceLists";
import { getEntriesForEvent } from "@/lib/queries/entries";
import { getEventById } from "@/lib/queries/events";
import { EventDetailClient } from "./EventDetailClient";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();

  const { id } = await params;
  const event = await getEventById(id);
  if (!event) {
    notFound();
  }

  const entries = await getEntriesForEvent(id);

  const publishAccount = user.isAdmin ? await getStoredMoxfieldUsername() : null;

  // the stored lists now, with any refresh (or the very first fetch) left until the page has been sent
  const [points, reserved, cardNames] = await Promise.all([
    pointsList.get(),
    reservedList.get(),
    cardNamesList.get(),
  ]);
  after(pointsList.refreshIfStale);
  after(reservedList.refreshIfStale);
  after(cardNamesList.refreshIfStale);

  return (
    <EventDetailClient
      event={event}
      entries={entries}
      currentUser={user}
      publishAccount={publishAccount}
      pointsList={points?.data ?? null}
      reservedNames={reserved?.data ?? null}
      cardNamesVersion={cardNames?.fetchedAt.getTime() ?? null}
    />
  );
}
