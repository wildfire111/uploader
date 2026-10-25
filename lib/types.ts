export type EventStatus = "draft" | "submitted" | "published";

export type Event = {
  id: string;
  name: string;
  fullName: string;
  date: string;
  attendance: number;
  status: EventStatus;
  createdBy: string;
  createdAt: string;
  moxfieldFolderId: string | null;
  // an admin has unlocked the details of an event that has lists on Moxfield; cleared on publish
  metadataUnlocked: boolean;
};

export type Entry = {
  id: string;
  eventId: string;
  placingFrom: number;
  placingTo: number | null;
  playerName: string;
  deckName: string;
  decklistRaw: string;
  moxfieldDeckId: string | null;
  // deck created by moxfield but the cards failed; the retry reuses it
  moxfieldPendingDeckId: string | null;
  publishClaimedAt: string | null;
  createdAt: string;
};

export type AllowedUser = {
  email: string;
  isAdmin: boolean;
};

export type EventListItem = Event & {
  entryCount: number;
  publishedCount: number;
};

// what a person types for one result
export type EntryInput = {
  placingFrom: number;
  placingTo: number | null;
  playerName: string;
  deckName: string;
  decklistRaw: string;
};

// what a person types for an event
export type EventDetailsInput = {
  name: string;
  fullName: string;
  date: string;
  attendance: number;
};
