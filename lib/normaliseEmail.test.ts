import { describe, expect, it } from "vitest";
import { normaliseEmail } from "./normaliseEmail";

describe("normaliseEmail", () => {
  it("lowercases and trims surrounding whitespace", () => {
    expect(normaliseEmail("  Jo@Example.com ")).toBe("jo@example.com");
  });

  it("leaves an already-normalised email unchanged", () => {
    expect(normaliseEmail("jo@example.com")).toBe("jo@example.com");
  });
});
