import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishDeck } from "./moxfield";
import { MoxfieldRateLimitedError } from "./moxfieldErrors";
import { moxfieldFetch } from "./moxfieldHttp";

vi.mock("server-only", () => ({}));
vi.mock("./moxfieldAuth", () => ({ getValidAccessToken: vi.fn(async () => "token") }));
vi.mock("./moxfieldHttp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./moxfieldHttp")>()),
  moxfieldFetch: vi.fn(),
}));

const input = {
  title: "t",
  description: "d",
  decklist: "1 Island",
  companion: null,
  folderId: "folder",
  pendingDeckId: "oldDeck",
  onDeckCreated: vi.fn(async () => {}),
};

beforeEach(() => {
  vi.mocked(moxfieldFetch).mockReset();
});

describe("publishDeck cleanup", () => {
  it("stops without creating the deck when Moxfield rate limits the cleanup delete", async () => {
    vi.mocked(moxfieldFetch).mockRejectedValueOnce(new MoxfieldRateLimitedError());

    await expect(publishDeck(input)).rejects.toBeInstanceOf(MoxfieldRateLimitedError);
    expect(moxfieldFetch).toHaveBeenCalledTimes(1);
  });

  it("carries on to the create when the cleanup delete fails for another reason", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(moxfieldFetch)
      .mockRejectedValueOnce(new Error("Could not reach Moxfield (network error or timeout)."))
      .mockResolvedValueOnce(new Response("{}", { status: 500 }));

    await expect(publishDeck(input)).rejects.toThrow("would not create the deck");
    expect(moxfieldFetch).toHaveBeenCalledTimes(2);
  });
});
