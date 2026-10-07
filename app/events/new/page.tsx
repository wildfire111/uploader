import { createEventAction } from "@/lib/actions/events";
import { requireUser } from "@/lib/guards";
import {
  MAX_ATTENDANCE,
  MAX_EVENT_FULL_NAME_LENGTH,
  MAX_EVENT_NAME_LENGTH,
  MAX_EVENT_YEAR,
  MIN_EVENT_YEAR,
} from "@/lib/validation";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    name?: string;
    fullName?: string;
    date?: string;
    attendance?: string;
  }>;
}) {
  await requireUser();

  const params = await searchParams;

  return (
    <main>
      <h1>New event</h1>
      {params.error ? <p className="error">{params.error}</p> : null}
      <form action={createEventAction}>
        <label htmlFor="name">Event code</label>
        <input
          type="text"
          id="name"
          name="name"
          maxLength={MAX_EVENT_NAME_LENGTH}
          placeholder="GGGongIQ26"
          defaultValue={params.name}
          required
        />
        <p className="-mt-2 text-sm text-muted">
          The short code that goes in each deck&apos;s title.
        </p>

        <label htmlFor="fullName">Full event name</label>
        <input
          type="text"
          id="fullName"
          name="fullName"
          maxLength={MAX_EVENT_FULL_NAME_LENGTH}
          placeholder="Adventurers Guild IQ"
          defaultValue={params.fullName}
          required
        />
        <p className="-mt-2 text-sm text-muted">
          The event&apos;s proper name, written in each deck&apos;s description.
        </p>

        <label htmlFor="date">Date</label>
        <input
          type="date"
          id="date"
          name="date"
          min={`${MIN_EVENT_YEAR}-01-01`}
          max={`${MAX_EVENT_YEAR}-12-31`}
          defaultValue={params.date}
          required
        />

        <label htmlFor="attendance">Attendance</label>
        <input
          type="number"
          id="attendance"
          name="attendance"
          min={1}
          max={MAX_ATTENDANCE}
          step={1}
          defaultValue={params.attendance}
          required
        />

        <button type="submit" data-variant="primary">
          Save
        </button>
      </form>
    </main>
  );
}
