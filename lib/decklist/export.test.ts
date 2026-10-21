import { describe, expect, it } from "vitest";
import { prepareForMoxfield } from "./export";
import { aliasIndex } from "./fixtures";

describe("prepareForMoxfield", () => {
  it("swaps a flavor name for the real name, keeping quantity, set and foil marker", () => {
    const raw = "1 Widow-Making Infiltrator\r\n2x Widow-Making Infiltrator (MAR) 63 *F*\nSB: 1 widow-making infiltrator\n1 Island";
    expect(prepareForMoxfield(raw, { aliases: aliasIndex }).importText).toBe(
      "1 Dauthi Voidwalker\n2x Dauthi Voidwalker (MAR) 63 *F*\n1 Island\n\nSideboard:\n1 Dauthi Voidwalker"
    );
  });

  it("does nothing to names without aliases", () => {
    expect(prepareForMoxfield("1 Widow-Making Infiltrator", { aliases: null }).importText).toBe(
      "1 Widow-Making Infiltrator"
    );
  });

  it("strips * points markers", () => {
    expect(prepareForMoxfield("1 Lightning Bolt *\n1 Flash (MH2) 55 *\n1 Island *F*", { aliases: null }).importText).toBe(
      "1 Lightning Bolt\n1 Flash (MH2) 55\n1 Island *F*"
    );
  });

  it.each(["Sideboard", "// SIDEBOARD", "Sideboard (15)", "SB:"])(
    "writes a %s line as the header Moxfield splits on, with a blank line before it",
    (header) => {
      expect(prepareForMoxfield(`1 Flash\n${header}\n1 Island`, { aliases: null }).importText).toBe(
        "1 Flash\n\nSideboard:\n1 Island"
      );
    }
  );

  it("drops blank lines and headers that Moxfield wouldn't understand", () => {
    expect(prepareForMoxfield("Deck\n\n1 Flash\n\n\n1 Island", { aliases: null }).importText).toBe("1 Flash\n1 Island");
  });

  it("takes the companion out of the text and returns its real name", () => {
    const raw = "1 Flash\nCompanion\n1 Widow-Making Infiltrator\nSideboard\n1 Island";
    expect(prepareForMoxfield(raw, { aliases: aliasIndex })).toEqual({
      importText: "1 Flash\n\nSideboard:\n1 Island",
      companion: "Dauthi Voidwalker",
    });
  });

  it("takes a companion written (Companion) after its card out of the text too", () => {
    const raw = "1 Flash\nSideboard\n1 Island\n1 Widow-Making Infiltrator (MAR) 63 (Companion)";
    expect(prepareForMoxfield(raw, { aliases: aliasIndex })).toEqual({
      importText: "1 Flash\n\nSideboard:\n1 Island",
      companion: "Dauthi Voidwalker",
    });
  });

  it("has no companion when none is marked", () => {
    expect(prepareForMoxfield("1 Flash", { aliases: null }).companion).toBeNull();
  });
});
