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
};
