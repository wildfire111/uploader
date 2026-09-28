import { describe, expect, it } from "vitest";
import { readJwtExpiry } from "./jwt";

function fakeJwt(payload: unknown): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256" })}.${part(payload)}.signature`;
}

describe("readJwtExpiry", () => {
  it("reads the exp claim as a date", () => {
    expect(readJwtExpiry(fakeJwt({ exp: 1_800_000_000, iat: 1_799_999_100 }))?.toISOString()).toBe(
      "2027-01-15T08:00:00.000Z"
    );
  });

  it("returns null when there is no exp", () => {
    expect(readJwtExpiry(fakeJwt({ iat: 1 }))).toBeNull();
  });

  it("returns null when exp isn't a number", () => {
    expect(readJwtExpiry(fakeJwt({ exp: "soon" }))).toBeNull();
  });

  it("returns null for something that isn't a JWT", () => {
    expect(readJwtExpiry("not-a-jwt")).toBeNull();
    expect(readJwtExpiry("a.b.c")).toBeNull();
    expect(readJwtExpiry("")).toBeNull();
  });
});
