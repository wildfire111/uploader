import { describe, expect, it } from "vitest";
import { cleanUserAgent, MAX_USER_AGENT_LENGTH } from "./userAgent";

describe("cleanUserAgent", () => {
  it("accepts a value with spaces and a semicolon", () => {
    expect(cleanUserAgent("MoxKey; someaccount 0123456789ab")).toEqual({
      ok: true,
      value: "MoxKey; someaccount 0123456789ab",
    });
  });

  it("trims spaces and strips surrounding quotes", () => {
    expect(cleanUserAgent('  "MoxKey; someaccount 0123"  ')).toEqual({
      ok: true,
      value: "MoxKey; someaccount 0123",
    });
    expect(cleanUserAgent("'MoxKey; x'")).toEqual({ ok: true, value: "MoxKey; x" });
  });

  it("keeps quotes that are inside the value", () => {
    expect(cleanUserAgent('Agent "v2" build')).toEqual({ ok: true, value: 'Agent "v2" build' });
  });

  it("refuses an empty value", () => {
    expect(cleanUserAgent("").ok).toBe(false);
    expect(cleanUserAgent('  ""  ').ok).toBe(false);
  });

  it("refuses more than one line", () => {
    expect(cleanUserAgent("MoxKey; a\nMoxKey; b")).toEqual({
      ok: false,
      error: "The User-Agent must be a single line of plain text.",
    });
  });

  it("refuses a value that is too long", () => {
    expect(cleanUserAgent("x".repeat(MAX_USER_AGENT_LENGTH)).ok).toBe(true);
    expect(cleanUserAgent("x".repeat(MAX_USER_AGENT_LENGTH + 1)).ok).toBe(false);
  });
});
