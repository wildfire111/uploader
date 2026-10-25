import type { EventStatus } from "./types";

const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  submitted: "Submitted for review",
  published: "Published to Moxfield",
};

export function getStatusLabel(status: EventStatus): string {
  return STATUS_LABELS[status];
}

// a reopened event is submitted again, with some of its lists already on Moxfield
export function getStatusLabelWithProgress(
  status: EventStatus,
  publishedCount: number,
  entryCount: number
): string {
  if (status === "submitted" && publishedCount > 0) {
    return `${STATUS_LABELS[status]} · ${publishedCount} of ${entryCount} published`;
  }
  return STATUS_LABELS[status];
}
