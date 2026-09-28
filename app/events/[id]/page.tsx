import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStoredMoxfieldUsername } from "@/lib/moxfieldAuth";
import { getEntriesForEvent } from "@/lib/queries/entries";
import { getEventById } from "@/lib/queries/events";
import { EventDetailClient } from "./EventDetailClient";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser(await headers());
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const event = await getEventById(id);
  if (!event) {
    notFound();
  }

  const entries = await getEntriesForEvent(id);

  const publishAccount = user.isAdmin ? await getStoredMoxfieldUsername() : null;

  return (
    <EventDetailClient
      event={event}
      entries={entries}
      currentUser={user}
      publishAccount={publishAccount}
    />
  );
}
