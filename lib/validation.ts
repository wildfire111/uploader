import type { EntryInput, EventDetailsInput } from "./types";

export const MAX_EVENT_NAME_LENGTH = 100;
export const MAX_EVENT_FULL_NAME_LENGTH = 100;
// keeps the number inside the integer column
export const MAX_ATTENDANCE = 10_000;
// year 0000 passes Date() but not postgres
export const MIN_EVENT_YEAR = 2000;
export const MAX_EVENT_YEAR = 2099;
export const MAX_PLAYER_NAME_LENGTH = 80;
export const MAX_DECK_NAME_LENGTH = 80;
export const MAX_DECKLIST_LENGTH = 20_000;

export function validateEntryInput(input: EntryInput): string | null {
  if (!Number.isInteger(input.placingFrom) || input.placingFrom < 1) {
    return "Placing must be a whole number of 1 or more.";
  }
  if (input.placingTo !== null && input.placingTo <= input.placingFrom) {
    return "Placing (to) must be greater than placing (from).";
  }
  if (input.playerName === "" || input.deckName === "" || input.decklistRaw.trim() === "") {
    return "Player, deck, and decklist are all required.";
  }
  if (input.playerName.length > MAX_PLAYER_NAME_LENGTH) {
    return `Player name can be at most ${MAX_PLAYER_NAME_LENGTH} characters.`;
  }
  if (input.deckName.length > MAX_DECK_NAME_LENGTH) {
    return `Deck name can be at most ${MAX_DECK_NAME_LENGTH} characters.`;
  }
  if (input.decklistRaw.length > MAX_DECKLIST_LENGTH) {
    return `The decklist is too long (at most ${MAX_DECKLIST_LENGTH.toLocaleString("en-AU")} characters).`;
  }
  return null;
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateEventDetails(input: EventDetailsInput): string | null {
  if (input.name.trim() === "") {
    return "Enter an event code.";
  }
  if (input.name.trim().length > MAX_EVENT_NAME_LENGTH) {
    return `Event code can be at most ${MAX_EVENT_NAME_LENGTH} characters.`;
  }
  if (input.fullName.trim() === "") {
    return "Enter the full event name.";
  }
  if (input.fullName.trim().length > MAX_EVENT_FULL_NAME_LENGTH) {
    return `Full event name can be at most ${MAX_EVENT_FULL_NAME_LENGTH} characters.`;
  }
  if (!isRealDate(input.date.trim())) {
    return "Enter a valid date.";
  }
  const year = Number(input.date.trim().slice(0, 4));
  if (year < MIN_EVENT_YEAR || year > MAX_EVENT_YEAR) {
    return `Enter a date between ${MIN_EVENT_YEAR} and ${MAX_EVENT_YEAR}.`;
  }
  if (!Number.isInteger(input.attendance) || input.attendance < 1) {
    return "Attendance must be a whole number of 1 or more.";
  }
  if (input.attendance > MAX_ATTENDANCE) {
    return `Attendance can be at most ${MAX_ATTENDANCE.toLocaleString("en-AU")}.`;
  }
  return null;
}
