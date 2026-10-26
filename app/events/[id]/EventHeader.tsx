import { formatDisplayDate } from "@/lib/formatDate";
import { getStatusLabelWithProgress } from "@/lib/statusLabel";
import type { Event } from "@/lib/types";
import {
  MAX_ATTENDANCE,
  MAX_EVENT_FULL_NAME_LENGTH,
  MAX_EVENT_NAME_LENGTH,
  MAX_EVENT_YEAR,
  MIN_EVENT_YEAR,
} from "@/lib/validation";
import { ActionMenu, type ActionMenuItem } from "./ActionMenu";
import type { EventDetailsEditor } from "./useEventDetails";

// the event's title (or its edit form) and the buttons for what can be done with the event
export function EventHeader({
  backLink,
  event,
  details,
  entryCount,
  publishedCount,
  canEdit,
  canDelete,
  canSubmit,
  canPublish,
  canReopen,
  canReturnToDraft,
  canUnlock,
  detailsLocked,
  editInProgress,
  isPending,
  isPublishing,
  retryInSeconds,
  onDelete,
  onSubmit,
  onPublish,
  onReopen,
  onReturnToDraft,
  onUnlock,
}: {
  // the link back to the events list, placed on the title's line
  backLink: React.ReactNode;
  event: Event;
  details: EventDetailsEditor;
  entryCount: number;
  publishedCount: number;
  canEdit: boolean;
  canDelete: boolean;
  canSubmit: boolean;
  canPublish: boolean;
  canReopen: boolean;
  canReturnToDraft: boolean;
  canUnlock: boolean;
  // the details went out with published lists and haven't been unlocked
  detailsLocked: boolean;
  editInProgress: boolean;
  isPending: boolean;
  isPublishing: boolean;
  // seconds left before Publish can be tried again after a failure
  retryInSeconds: number | null;
  onDelete: () => void;
  onSubmit: () => void;
  onPublish: () => void;
  onReopen: () => void;
  onReturnToDraft: () => void;
  onUnlock: () => void;
}) {
  const { fields, setFields } = details;
  const menuItems: ActionMenuItem[] = [];
  if (canUnlock) {
    menuItems.push({ label: "Unlock details", onSelect: onUnlock, disabled: isPending || editInProgress });
  }
  if (canReturnToDraft) {
    menuItems.push({
      label: "Return to draft",
      onSelect: onReturnToDraft,
      disabled: isPending || editInProgress,
    });
  }
  if (canDelete) {
    menuItems.push({ label: "Delete event", onSelect: onDelete, disabled: isPending, danger: true });
  }

  return (
    <div className="page-header">
      <div className="page-header-main">
        {details.editing ? (
          <div>
            <p className="back-link">{backLink}</p>
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
          <div className="event-title">
            <p className="back-link">{backLink}</p>
            <h1 title={event.name}>{event.name}</h1>
            <p className="event-meta">
              <span>{formatDisplayDate(event.date)}</span>
              <span aria-hidden="true">&middot;</span>
              <span className="tabular-nums">{event.attendance} players</span>
              <span className="status-badge" data-status={event.status}>
                {getStatusLabelWithProgress(event.status, publishedCount, entryCount)}
              </span>
              {canEdit ? (
                <button
                  type="button"
                  className="link-button"
                  onClick={details.start}
                  disabled={editInProgress}
                >
                  Edit details
                </button>
              ) : null}
            </p>
            {detailsLocked ? (
              <p className="text-muted">
                The details are locked because some lists are already on Moxfield with them.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {!details.editing ? (
        <div className="button-row">
          {canReopen ? (
            <button type="button" onClick={onReopen} disabled={isPending}>
              Reopen to add lists
            </button>
          ) : null}
          <ActionMenu label="More" items={menuItems} />
          {canSubmit ? (
            <button type="button" data-variant="primary" onClick={onSubmit} disabled={isPending}>
              Submit for review
            </button>
          ) : null}
          {canPublish ? (
            <button
              type="button"
              data-variant="primary"
              className="publish-button"
              onClick={onPublish}
              disabled={isPublishing || retryInSeconds !== null}
              title={
                retryInSeconds !== null
                  ? "Publishing failed. It can be tried again when the countdown ends."
                  : undefined
              }
            >
              {isPublishing
                ? "Publishing\u2026"
                : retryInSeconds !== null
                  ? `Retry in ${retryInSeconds}s`
                  : "Publish to Moxfield"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
