import { notFound } from "next/navigation";
import { requireUser } from "@/lib/guards";
import { getStoredMoxfieldUsername } from "@/lib/moxfieldAuth";
import { RefreshingData } from "@/app/RefreshingData";
import {
  cardAliasesList,
  cardNamesList,
  companionsList,
  pointsList,
  reservedList,
  staleListNames,
} from "@/lib/referenceLists";
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

  // the stored lists; any that are stale are refreshed behind a popup, then the page reloads with them
  const [points, reserved, cardNames, aliases, companions, stale] = await Promise.all([
    pointsList.get(),
    reservedList.get(),
    cardNamesList.get(),
    cardAliasesList.get(),
    companionsList.get(),
    staleListNames([pointsList, reservedList, cardNamesList, cardAliasesList, companionsList]),
  ]);

  return (
    <>
      <RefreshingData names={stale} />
      <EventDetailClient
        event={event}
        entries={entries}
        currentUser={user}
        publishAccount={publishAccount}
        pointsList={points?.data ?? null}
        reservedNames={reserved?.data ?? null}
        aliasList={aliases?.data ?? null}
        companionNames={companions?.data ?? null}
        cardNamesVersion={cardNames?.fetchedAt.getTime() ?? null}
      />
    </>
  );
}
