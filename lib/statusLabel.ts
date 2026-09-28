import type { EventStatus } from "./types";

const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  submitted: "Submitted for review",
  published: "Published to Moxfield",
};

export function getStatusLabel(status: EventStatus): string {
  return STATUS_LABELS[status];
}
