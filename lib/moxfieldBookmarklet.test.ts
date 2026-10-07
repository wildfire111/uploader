import { describe, expect, it } from "vitest";
import { buildBookmarkletHref, parseTokenFragment } from "./moxfieldBookmarklet";

const TOKEN = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

describe("parseTokenFragment", () => {
  it("reads the token and account name", () => {
    expect(parseTokenFragment(`#rt=${TOKEN}&u=wildfire1`)).toEqual({
      refreshToken: TOKEN,
      userName: "wildfire1",
    });
  });

  it("decodes percent-encoded values", () => {
    expect(parseTokenFragment(`#rt=${TOKEN}&u=wild%20fire`)?.userName).toBe("wild fire");
  });

  it("allows a missing account name", () => {
    expect(parseTokenFragment(`#rt=${TOKEN}`)).toEqual({ refreshToken: TOKEN, userName: null });
    expect(parseTokenFragment(`#rt=${TOKEN}&u=`)?.userName).toBeNull();
  });

  it("rejects a missing or empty token", () => {
    expect(parseTokenFragment("")).toBeNull();
    expect(parseTokenFragment("#")).toBeNull();
    expect(parseTokenFragment("#u=wildfire1")).toBeNull();
    expect(parseTokenFragment("#rt=")).toBeNull();
  });

  it("rejects a token that is too long or has whitespace", () => {
    expect(parseTokenFragment(`#rt=${"a".repeat(201)}`)).toBeNull();
    expect(parseTokenFragment("#rt=abc%20def")).toBeNull();
  });

  it("rejects an oversized account name", () => {
    expect(parseTokenFragment(`#rt=${TOKEN}&u=${"a".repeat(101)}`)).toBeNull();
  });

  it("ignores unrelated fragments", () => {
    expect(parseTokenFragment("#section-2")).toBeNull();
  });
});

describe("buildBookmarkletHref", () => {
  it("is one javascript: URL with the app origin embedded", () => {
    const href = buildBookmarkletHref("https://uploader.example.com/some/path?x=1");
    expect(href.startsWith("javascript:")).toBe(true);
    expect(href).toContain('"https://uploader.example.com"');
    expect(href).not.toContain("/some/path");
  });

  it("has nothing a javascript: URL would mangle", () => {
    const href = buildBookmarkletHref("http://localhost:3000");
    expect(href).not.toMatch(/[%#\n\r]/);
    expect(href).not.toContain("__ORIGIN__");
  });

  it("is syntactically valid JavaScript", () => {
    const body = buildBookmarkletHref("http://localhost:3000").slice("javascript:".length);
    expect(() => new Function(`return async () => { ${body} }`)).not.toThrow();
  });
});
