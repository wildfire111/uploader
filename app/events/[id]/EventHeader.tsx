import { formatDisplayDate } from "@/lib/formatDate";
import { getStatusLabel } from "@/lib/statusLabel";
import type { Event } from "@/lib/types";
import {
  MAX_ATTENDANCE,
  MAX_EVENT_FULL_NAME_LENGTH,
  MAX_EVENT_NAME_LENGTH,
  MAX_EVENT_YEAR,
  MIN_EVENT_YEAR,
} from "@/lib/validation";
import type { EventDetailsEditor } from "./useEventDetails";

// the event's title (or its edit form) and the buttons for what can be done with the event
export function EventHeader({
  event,
  details,
  canEdit,
  canDelete,
  canSubmit,
  canPublish,
  editInProgress,
  isPending,
  isPublishing,
  retryInSeconds,
  onDelete,
  onSubmit,
  onPublish,
}: {
  event: Event;
  details: EventDetailsEditor;
  canEdit: boolean;
  canDelete: boolean;
  canSubmit: boolean;
  canPublish: boolean;
  editInProgress: boolean;
  isPending: boolean;
  isPublishing: boolean;
  // seconds left before Publish can be tried again after a failure
  retryInSeconds: number | null;
  onDelete: () => void;
  onSubmit: () => void;
  onPublish: () => void;
}) {
  const { fields, setFields } = details;
  return (
    <div className="page-header">
      <div>
        {details.editing ? (
          <div>
            {details.error ? <p className="error">{details.error}</p> : null}
            <div className="field-row">
              <label>
                Event code
                <input
                  type="text"
                  maxLength={MAX_EVENT_NAME_LENGTH}
                  value={fields.name}
                  onChange={(e) => setFields({ ...fields, name: e.target.value })}
                />
              </label>
              <label>
                Full event name
                <input
                  type="text"
                  maxLength={MAX_EVENT_FULL_NAME_LENGTH}
                  value={fields.fullName}
                  onChange={(e) => setFields({ ...fields, fullName: e.target.value })}
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  min={`${MIN_EVENT_YEAR}-01-01`}
                  max={`${MAX_EVENT_YEAR}-12-31`}
                  value={fields.date}
                  onChange={(e) => setFields({ ...fields, date: e.target.value })}
                />
              </label>
              <label>
                Attendance
                <input
                  type="number"
                  min={1}
                  max={MAX_ATTENDANCE}
                  step={1}
                  value={fields.attendance}
                  onChange={(e) => setFields({ ...fields, attendance: e.target.value })}
                />
              </label>
            </div>
            <div className="button-row mt-3">
              <button type="button" onClick={details.cancel} disabled={isPending}>
                Cancel
              </button>
              <button type="button" data-variant="primary" onClick={details.save} disabled={isPending}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <h1>
            {event.name} &middot; {formatDisplayDate(event.date)} &middot; {event.attendance}{" "}
            players &middot; {getStatusLabel(event.status)}
          </h1>
        )}
      </div>

      {!details.editing ? (
        <div className="button-row">
          {canEdit ? (
            <button type="button" onClick={details.start} disabled={editInProgress}>
              Edit details
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" data-variant="danger" onClick={onDelete} disabled={isPending}>
              Delete
            </button>
          ) : null}
          {canSubmit ? (
            <button type="button" data-variant="primary" onClick={onSubmit} disabled={isPending}>
              Submit for review
            </button>
          ) : null}
          {canPublish ? (
            <button
              type="button"
              data-variant="primary"
              onClick={onPublish}
              disabled={isPublishing || retryInSeconds !== null}
            >
              {retryInSeconds !== null
                ? `Publish to Moxfield (retry in ${retryInSeconds}s)`
                : "Publish to Moxfield"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
