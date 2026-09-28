import { describe, expect, it } from "vitest";
import {
  isDeadRefreshTokenResponse,
  parseBulkEditResponse,
  parseCreateDeckResponse,
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

describe("parseBulkEditResponse", () => {
  it("accepts isSuccessful: true", () => {
    expect(parseBulkEditResponse({ isSuccessful: true, errors: null })).toEqual({ ok: true });
  });

  it("fails on a 200-with-isSuccessful-false and names each bad line", () => {
    const result = parseBulkEditResponse({
      isSuccessful: false,
      errors: {
        boards: {
          mainboard: [
            { lineNumber: 3, errorMessage: "Could not find card 'Lightnin Bolt'", originalText: "1 Lightnin Bolt" },
            { lineNumber: 7, errorMessage: "Could not find card 'Fooo'", originalText: "1 Fooo" },
          ],
        },
      },
    });
    expect(result).toEqual({
      ok: false,
      message:
        "Moxfield could not read the decklist — Line 3: Could not find card 'Lightnin Bolt'; Line 7: Could not find card 'Fooo'",
    });
  });

  it("caps how many bad lines it lists", () => {
    const mainboard = Array.from({ length: 8 }, (_, i) => ({ lineNumber: i + 1, errorMessage: "bad" }));
    const result = parseBulkEditResponse({ isSuccessful: false, errors: { boards: { mainboard } } });
    expect(result.ok === false && result.message).toContain("Line 5: bad (and 3 more)");
  });

  it("still fails, with a generic message, when there are no line details", () => {
    expect(parseBulkEditResponse({ isSuccessful: false })).toEqual({
      ok: false,
      message: "Moxfield did not accept the decklist.",
    });
  });

  it("never treats an unexpected body as success", () => {
    expect(parseBulkEditResponse(null).ok).toBe(false);
    expect(parseBulkEditResponse({}).ok).toBe(false);
    expect(parseBulkEditResponse("ok").ok).toBe(false);
  });
});

describe("parseCreateDeckResponse", () => {
  it("returns the new deck's publicId", () => {
    expect(parseCreateDeckResponse({ isSuccessful: true, errors: null, publicId: "abc123" })).toEqual({
      ok: true,
      publicId: "abc123",
    });
  });

  it("fails without a publicId", () => {
    expect(parseCreateDeckResponse({ isSuccessful: true }).ok).toBe(false);
    expect(parseCreateDeckResponse({ isSuccessful: false, publicId: "abc" }).ok).toBe(false);
    expect(parseCreateDeckResponse(null).ok).toBe(false);
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
