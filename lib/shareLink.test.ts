import { describe, expect, it } from "vitest";
import { isShareLink } from "./shareLink";

describe("isShareLink", () => {
  it("accepts a share link on this host", () => {
    expect(isShareLink("https://example.com/sideboard#plan=abc", "example.com")).toBe(true);
  });

  it("rejects another host, another page and a link without a plan", () => {
    expect(isShareLink("https://evil.com/sideboard#plan=abc", "example.com")).toBe(false);
    expect(isShareLink("https://example.com/events#plan=abc", "example.com")).toBe(false);
    expect(isShareLink("https://example.com/sideboard", "example.com")).toBe(false);
  });

  it("rejects text that is not a URL and links that are too long", () => {
    expect(isShareLink("not a url", "example.com")).toBe(false);
    expect(isShareLink(`https://example.com/sideboard#plan=${"a".repeat(5000)}`, "example.com")).toBe(false);
  });
});
