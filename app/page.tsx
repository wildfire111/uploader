import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { formatDisplayDate } from "@/lib/formatDate";
import { getEventsForUser } from "@/lib/queries/events";
import { getStatusLabel } from "@/lib/statusLabel";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const user = await requireUser();

  const { submitted } = await searchParams;
  const events = await getEventsForUser(user);

  return (
    <main>
      <div className="page-header">
        <h1>Events</h1>
        <div className="button-row">
          <Link href="/events/new">
            <button type="button" data-variant="primary">
              + New event
            </button>
          </Link>
        </div>
      </div>

      {submitted === "1" ? (
        <p>Submitted for review. An admin will check it before it&apos;s published to Moxfield.</p>
      ) : null}

      <table>
        <thead>
          <tr>
            <th className="cell-name">Name</th>
            <th>Date</th>
            <th>Decks</th>
            <th>Status</th>
            {user.isAdmin ? <th>Submitted by</th> : null}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td className="cell-name" title={event.name}>
                <Link href={`/events/${event.id}`}>{event.name}</Link>
              </td>
              <td>{formatDisplayDate(event.date)}</td>
              <td>{event.entryCount}</td>
              <td>{getStatusLabel(event.status)}</td>
              {user.isAdmin ? (
                <td>{event.createdBy === user.email ? "(you)" : event.createdBy}</td>
              ) : null}
            </tr>
          ))}
          {events.length === 0 ? (
            <tr>
              <td colSpan={user.isAdmin ? 5 : 4}>No events yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </main>
  );
}
