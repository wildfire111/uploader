import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./secretBox";

const key = randomBytes(32).toString("base64");

describe("secretBox", () => {
  it("round-trips a value", () => {
    expect(decryptSecret(encryptSecret("00000000-0000-4000-8000-000000000000", key), key)).toBe(
      "00000000-0000-4000-8000-000000000000"
    );
  });

  it("round-trips non-ASCII text and an empty string", () => {
    expect(decryptSecret(encryptSecret("héllo ✓", key), key)).toBe("héllo ✓");
    expect(decryptSecret(encryptSecret("", key), key)).toBe("");
  });

  it("never stores the plaintext", () => {
    expect(encryptSecret("super-secret-token", key)).not.toContain("super-secret-token");
  });

  it("uses a fresh random IV, so encrypting twice gives different output", () => {
    expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
  });

  it("refuses to decrypt with a different key", () => {
    const other = randomBytes(32).toString("base64");
    expect(() => decryptSecret(encryptSecret("x", key), other)).toThrow(/could not be decrypted/);
  });

  it("refuses a tampered value", () => {
    const [v, iv, tag, data] = encryptSecret("some token value", key).split(":");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64")].join(":"), key)).toThrow(
      /could not be decrypted/
    );
  });

  it("refuses a value that isn't in the expected format", () => {
    expect(() => decryptSecret("garbage", key)).toThrow(/expected format/);
  });

  it("refuses a key that isn't 32 bytes", () => {
    expect(() => encryptSecret("x", "c2hvcnQ=")).toThrow(/32 random bytes/);
    expect(() => encryptSecret("x", "")).toThrow(/32 random bytes/);
  });
});
