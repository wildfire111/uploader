import type { AllowedUser, Entry, Event } from "./types";

// creators edit their own drafts, admins edit submitted events, nobody edits published ones
export function canEditEvent(user: AllowedUser, event: Event): boolean {
  const ownsDraft = event.status === "draft" && event.createdBy === user.email;
  const adminReviewingSubmitted = user.isAdmin && event.status === "submitted";
  return ownsDraft || adminReviewingSubmitted;
}

export function canDeleteEvent(user: AllowedUser, event: Event): boolean {
  const ownsDraft = event.status === "draft" && event.createdBy === user.email;
  const adminDeletingNonDraft = user.isAdmin && event.status !== "draft";
  return ownsDraft || adminDeletingNonDraft;
}

// an entry with a moxfield deck id is locked
export function canEditEntry(user: AllowedUser, event: Event, entry: Entry): boolean {
  if (entry.moxfieldDeckId !== null) {
    return false;
  }
  return canEditEvent(user, event);
}

export function canDeleteEntry(user: AllowedUser, event: Event, entry: Entry): boolean {
  return canEditEntry(user, event, entry);
}

export function canSubmitEvent(user: AllowedUser, event: Event, entries: Entry[]): boolean {
  if (event.status !== "draft") {
    return false;
  }
  if (entries.length === 0) {
    return false;
  }
  return canEditEvent(user, event);
}

export function canPublishEvent(user: AllowedUser, event: Event, entries: Entry[]): boolean {
  if (event.status !== "submitted") {
    return false;
  }
  if (entries.length === 0) {
    return false;
  }
  return user.isAdmin;
}

export function canPublishEntry(user: AllowedUser, event: Event): boolean {
  return user.isAdmin && event.status === "submitted";
}

// admins can't remove or demote themselves
export function canRemoveOrDemoteUser(actor: AllowedUser, targetEmail: string): boolean {
  return actor.email !== targetEmail;
}
