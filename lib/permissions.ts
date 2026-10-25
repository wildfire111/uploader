import type { AllowedUser, Entry, Event } from "./types";

// creators edit their own drafts, admins edit submitted events, nobody edits published ones
export function canEditEvent(user: AllowedUser, event: Event): boolean {
  const ownsDraft = event.status === "draft" && event.createdBy === user.email;
  const adminReviewingSubmitted = user.isAdmin && event.status === "submitted";
  return ownsDraft || adminReviewingSubmitted;
}

// the details go out on Moxfield with the folder and the first deck, so they lock from then on
// unless an admin unlocks them
export function areDetailsLocked(event: Event, entries: Entry[]): boolean {
  const hasPublishedContent =
    event.moxfieldFolderId !== null || entries.some((entry) => entry.moxfieldDeckId !== null);
  return hasPublishedContent && !event.metadataUnlocked;
}

export function canEditEventDetails(user: AllowedUser, event: Event, entries: Entry[]): boolean {
  return canEditEvent(user, event) && !areDetailsLocked(event, entries);
}

export function canUnlockMetadata(user: AllowedUser, event: Event, entries: Entry[]): boolean {
  return user.isAdmin && event.status === "submitted" && areDetailsLocked(event, entries);
}

// a published event goes back to review so the rest of the lists can be added
export function canReopenEvent(user: AllowedUser, event: Event): boolean {
  return user.isAdmin && event.status === "published";
}

// hands a submitted event back to its creator
export function canReturnToDraft(user: AllowedUser, event: Event): boolean {
  return user.isAdmin && event.status === "submitted";
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

// admins can't remove or demote themselves
export function canRemoveOrDemoteUser(actor: AllowedUser, targetEmail: string): boolean {
  return actor.email !== targetEmail;
}
