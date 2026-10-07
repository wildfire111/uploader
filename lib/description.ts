type DeckDescriptionInput = {
  date: string; // YYYY-MM-DD
  fullName: string;
  attendance: number;
};

export function formatDeckDescription(input: DeckDescriptionInput): string {
  const [year, month, day] = input.date.split("-");
  const players = input.attendance === 1 ? "1 player" : `${input.attendance} players`;
  return `${day}/${month}/${year.slice(-2)}, ${input.fullName.trim()}, ${players}`;
}
