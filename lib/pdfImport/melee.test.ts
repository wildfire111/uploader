import { describe, expect, it } from "vitest";
import { MeleeFormatError, parseMeleePdf, type PdfPage, type PdfTextItem } from "./melee";

const LEFT_X = 34;
const RIGHT_X = 301;
const LINE_HEIGHT = 11;

function item(str: string, x: number, y: number, width = str.length * 4): PdfTextItem {
  return { str, x, y, width };
}

// a column of lines the way the print renders them: an empty run, then the text, per line
function column(x: number, topY: number, lines: string[]): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  lines.forEach((line, index) => {
    const y = topY - index * LINE_HEIGHT;
    items.push(item("", x, y, 0));
    // "Creature (11)" arrives as three runs
    const header = line.match(/^(\D+) (\(\d+\))$/);
    if (header) {
      items.push(item(header[1], x, y, 40), item(" ", x + 40, y, 4), item(header[2], x + 42, y, 12));
    } else {
      items.push(item(line, x, y));
    }
  });
  return items;
}

type ListSpec = {
  n: number;
  of: number;
  player: string;
  deck: string;
  left: string[];
  right?: string[];
  // lines that carry on onto a second page
  overflow?: string[];
};

function listPages(spec: ListSpec): PdfPage[] {
  const header: PdfTextItem[] = [
    item("Test Organiser", 36, 797),
    item(" ", 128, 797, 573),
    item(`Decklist ${spec.n} of ${spec.of}`, 503, 797),
    item("Fictional Open 2026", 36, 779),
    item("Seating Table:", 295, 750),
    item("6", 370, 750),
    item("Match Table:", 299, 727),
    item("12", 370, 727),
    item("Player:", 88, 704),
    item(" ", 120, 704, 17),
    item(spec.player, 131, 704),
    item(" ", 181, 704, 187),
    item("Deck Name:", 304, 704),
    item(" ", 359, 704, 17),
    item(spec.deck, 370, 704),
    item("Format:", 83, 681),
    item("Vintage", 131, 681),
    item("Print Date:", 308, 681),
    item("Sunday, April 26, 2026", 370, 681),
  ];
  const first: PdfPage = {
    width: 595,
    items: [...header, ...column(LEFT_X, 655, spec.left), ...column(RIGHT_X, 655, spec.right ?? [])],
  };
  if (!spec.overflow) {
    return [first];
  }
  return [first, { width: 595, items: column(RIGHT_X, 805, spec.overflow) }];
}

describe("parseMeleePdf", () => {
  it("reads the player, deck name and cards of one list", () => {
    const pages = listPages({
      n: 1,
      of: 1,
      player: "doe, jane",
      deck: "Test Deck",
      left: ["Creature (2)", "1 Alpha Creature", "1 Beta Creature"],
      right: ["Land (1)", "1 Gamma Land", "Sideboard (1)", "1 Delta Hate"],
    });
    expect(parseMeleePdf(pages)).toEqual([
      {
        playerName: "doe, jane",
        deckName: "Test Deck",
        decklistRaw: "1 Alpha Creature\n1 Beta Creature\n1 Gamma Land\nSideboard\n1 Delta Hate",
      },
    ]);
  });

  it("reads the left column before the right, however the runs are ordered in the page", () => {
    const pages = listPages({
      n: 1,
      of: 1,
      player: "a, b",
      deck: "D",
      left: ["Instant (1)", "1 Left Card"],
      right: ["Land (1)", "1 Right Card"],
    });
    pages[0].items.reverse();
    expect(parseMeleePdf(pages)[0].decklistRaw).toBe("1 Left Card\n1 Right Card");
  });

  it("carries a list on to its second page and keeps the sideboard going", () => {
    const pages = listPages({
      n: 1,
      of: 1,
      player: "a, b",
      deck: "D",
      left: ["Instant (1)", "1 Main Card"],
      right: ["Sideboard (2)", "1 Side One"],
      overflow: ["1 Side Two"],
    });
    expect(parseMeleePdf(pages)[0].decklistRaw).toBe("1 Main Card\nSideboard\n1 Side One\n1 Side Two");
  });

  it("splits several lists, a continuation page staying with the list before it", () => {
    const pages = [
      ...listPages({ n: 1, of: 2, player: "one, p", deck: "First", left: ["Land (1)", "1 Land One"], overflow: ["1 More"] }),
      ...listPages({ n: 2, of: 2, player: "two, q", deck: "Second", left: ["Land (1)", "1 Land Two"] }),
    ];
    const lists = parseMeleePdf(pages);
    expect(lists.map((list) => list.deckName)).toEqual(["First", "Second"]);
    expect(lists[0].decklistRaw).toBe("1 Land One\n1 More");
    expect(lists[1].decklistRaw).toBe("1 Land Two");
  });

  it("does not read the header table or event name as cards", () => {
    const pages = listPages({ n: 1, of: 1, player: "a, b", deck: "D", left: ["Land (1)", "1 Real Card"] });
    // an event whose name starts with a number would look like a card line
    pages[0].items.push(item("2026 Worlds", 36, 770));
    expect(parseMeleePdf(pages)[0].decklistRaw).toBe("1 Real Card");
  });

  it("keeps quantities and double-faced names as printed", () => {
    const pages = listPages({
      n: 1,
      of: 1,
      player: "a, b",
      deck: "D",
      left: ["Land (2)", "4 Island", "1 Sink into Stupor // Soporific Springs"],
    });
    expect(parseMeleePdf(pages)[0].decklistRaw).toBe("4 Island\n1 Sink into Stupor // Soporific Springs");
  });

  it("gives a list with no cards an empty decklist rather than dropping it", () => {
    const pages = listPages({ n: 1, of: 1, player: "a, b", deck: "D", left: [] });
    expect(parseMeleePdf(pages)).toEqual([{ playerName: "a, b", deckName: "D", decklistRaw: "" }]);
  });

  it("leaves the player and deck empty when the header doesn't have them", () => {
    const pages = listPages({ n: 1, of: 1, player: "", deck: "", left: ["Land (1)", "1 Island"] });
    pages[0].items = pages[0].items.filter((i) => i.str !== "");
    const [list] = parseMeleePdf(pages);
    expect(list.playerName).toBe("");
    expect(list.deckName).toBe("");
    expect(list.decklistRaw).toBe("1 Island");
  });

  it("says so when the file isn't a Melee decklist print", () => {
    const pages: PdfPage[] = [{ width: 595, items: [item("Some other document", 40, 800)] }];
    expect(() => parseMeleePdf(pages)).toThrow(MeleeFormatError);
  });
});
