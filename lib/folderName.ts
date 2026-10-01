export type DeckFolderNameInput = {
  date: string; // YYYY-MM-DD
  fullName: string;
};

export function formatDeckFolderName(input: DeckFolderNameInput): string {
  return `${input.date.replace(/-/g, "")} - ${input.fullName.trim()}`;
}
