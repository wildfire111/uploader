import { describe, expect, it } from "vitest";
import { MAX_DECK_NAME_LENGTH, MAX_DECKLIST_LENGTH, MAX_PLAYER_NAME_LENGTH } from "../validation";
import { formatPlayerName, normaliseImportedEntry } from "./entry";

describe("formatPlayerName", () => {
  it("turns 'last, first' into first name and last initial, both capitalised", () => {
    expect(formatPlayerName("clarke, trent")).toBe("Trent C");
    expect(formatPlayerName("Fair, Henry")).toBe("Henry F");
  });

  it("keeps an initial that is already abbreviated", () => {
    expect(formatPlayerName("L, Michael")).toBe("Michael L");
  });

  it("title-cases a name printed all in capitals but leaves mixed case alone", () => {
    expect(formatPlayerName("SMITH, JOHN")).toBe("John S");
    expect(formatPlayerName("de la Cruz, DeAndre")).toBe("DeAndre D");
  });

  it("keeps every word of a longer first name", () => {
    expect(formatPlayerName("Tran, mary jane")).toBe("Mary Jane T");
  });

  it("splits on the first comma only", () => {
    expect(formatPlayerName("Jones, Robert, Jr")).toBe("Robert, Jr J");
  });

  it("falls back to the name as printed when it isn't 'last, first'", () => {
    expect(formatPlayerName("Madonna")).toBe("Madonna");
    expect(formatPlayerName(", trent")).toBe(", trent");
    expect(formatPlayerName("clarke,")).toBe("clarke,");
  });
});

describe("normaliseImportedEntry", () => {
  it("fills in a missing player and deck name", () => {
    expect(
      normaliseImportedEntry({ playerName: "  ", deckName: "", decklistRaw: "1 Island" })
    ).toEqual({ playerName: "Unknown player", deckName: "Unknown deck", decklistRaw: "1 Island" });
  });

  it("trims names", () => {
    const entry = normaliseImportedEntry({ playerName: " Ann B ", deckName: " Storm ", decklistRaw: "1 Island" });
    expect(entry.playerName).toBe("Ann B");
    expect(entry.deckName).toBe("Storm");
  });

  it("keeps a list with no cards in it, so the lists still line up with the PDF", () => {
    expect(normaliseImportedEntry({ playerName: "A B", deckName: "X", decklistRaw: "" }).decklistRaw).toBe(
      "No cards found"
    );
  });

  it("cuts overlong values to the limits", () => {
    const entry = normaliseImportedEntry({
      playerName: "p".repeat(MAX_PLAYER_NAME_LENGTH + 10),
      deckName: "d".repeat(MAX_DECK_NAME_LENGTH + 10),
      decklistRaw: "1 Island\n".repeat(MAX_DECKLIST_LENGTH),
    });
    expect(entry.playerName).toHaveLength(MAX_PLAYER_NAME_LENGTH);
    expect(entry.deckName).toHaveLength(MAX_DECK_NAME_LENGTH);
    expect(entry.decklistRaw.length).toBeLessThanOrEqual(MAX_DECKLIST_LENGTH);
    // cut on a line break so the last card isn't half a name
    expect(entry.decklistRaw.endsWith("1 Island")).toBe(true);
  });
});
