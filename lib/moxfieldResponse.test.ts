import { describe, expect, it } from "vitest";
import {
  isDeadRefreshTokenResponse,
  parseCreateFolderResponse,
  parseDeckImportResponse,
  parseRefreshResponse,
} from "./moxfieldResponse";

describe("isDeadRefreshTokenResponse", () => {
  it("recognises Moxfield's real dead-token reply", () => {
    expect(isDeadRefreshTokenResponse(400, { "": ["Invalid refresh token."] })).toBe(true);
  });

  it("does not treat rate limiting or outages as a dead token", () => {
    expect(isDeadRefreshTokenResponse(429, "Too many requests")).toBe(false);
    expect(isDeadRefreshTokenResponse(500, { "": ["Invalid refresh token."] })).toBe(false);
    expect(isDeadRefreshTokenResponse(502, null)).toBe(false);
  });

  it("does not treat an unrelated 400 as a dead token", () => {
    expect(isDeadRefreshTokenResponse(400, { "": ["Something else."] })).toBe(false);
    expect(isDeadRefreshTokenResponse(400, null)).toBe(false);
  });
});

describe("parseDeckImportResponse", () => {
  it("returns the new deck's short id when every line imports cleanly", () => {
    expect(
      parseDeckImportResponse({
        isSuccessful: true,
        errors: [],
        publicId: "abc123",
        deck: { id: "BBbx0M" },
      })
    ).toEqual({ ok: true, deckId: "BBbx0M" });
  });

  it("fails on a populated errors array even when isSuccessful is true", () => {
    const result = parseDeckImportResponse({
      isSuccessful: true,
      errors: [
        { lineNumber: 2, errorMessage: "Could not find card \"Fooo\".", originalText: "1 Fooo" },
      ],
      publicId: "abc123",
      deck: { id: "BBbx0M" },
    });
    expect(result).toEqual({
      ok: false,
      deckId: "BBbx0M",
      message: 'Moxfield could not read the decklist — Line 2: Could not find card "Fooo".',
    });
  });

  it("caps how many bad lines it lists", () => {
    const errors = Array.from({ length: 8 }, (_, i) => ({ lineNumber: i + 1, errorMessage: "bad" }));
    const result = parseDeckImportResponse({ errors, deck: { id: "BBbx0M" } });
    expect(result.ok === false && result.message).toContain("Line 5: bad (and 3 more)");
  });

  it("fails with no deck id when the deck object is missing entirely", () => {
    expect(parseDeckImportResponse({ isSuccessful: false })).toEqual({
      ok: false,
      deckId: null,
      message: "Moxfield did not create the deck.",
    });
  });

  it("never treats an unexpected body as success", () => {
    expect(parseDeckImportResponse(null)).toEqual({
      ok: false,
      deckId: null,
      message: "Moxfield did not create the deck.",
    });
    expect(parseDeckImportResponse({}).ok).toBe(false);
    expect(parseDeckImportResponse("ok").ok).toBe(false);
  });
});

describe("parseCreateFolderResponse", () => {
  it("returns the new folder's id", () => {
    expect(parseCreateFolderResponse({ id: "gmADx", name: "asdasdas" })).toEqual({
      ok: true,
      id: "gmADx",
    });
  });

  it("fails without an id", () => {
    expect(parseCreateFolderResponse({ name: "asdasdas" }).ok).toBe(false);
    expect(parseCreateFolderResponse(null).ok).toBe(false);
    expect(parseCreateFolderResponse("oops").ok).toBe(false);
  });
});

describe("parseRefreshResponse", () => {
  it("reads the tokens and the account name", () => {
    expect(
      parseRefreshResponse(
        { refresh: { access_token: "a", refresh_token: "r2", user_name: "wildfire1" } },
        "r1"
      )
    ).toEqual({ ok: true, accessToken: "a", refreshToken: "r2", userName: "wildfire1" });
  });

  it("keeps the token it sent if the reply has no new one", () => {
    const result = parseRefreshResponse({ refresh: { access_token: "a" } }, "r1");
    expect(result).toEqual({ ok: true, accessToken: "a", refreshToken: "r1", userName: null });
  });

  it("treats a missing or blank user_name as unknown", () => {
    expect(parseRefreshResponse({ refresh: { access_token: "a", user_name: "  " } }, "r1")).toMatchObject({
      userName: null,
    });
  });

  it("fails without an access token", () => {
    expect(parseRefreshResponse({ refresh: {} }, "r1").ok).toBe(false);
    expect(parseRefreshResponse(null, "r1").ok).toBe(false);
    expect(parseRefreshResponse({ refresh: { access_token: 5 } }, "r1").ok).toBe(false);
  });
});
