import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MoxfieldRateLimitedError } from "./moxfieldErrors";
import { moxfieldFetch } from "./moxfieldHttp";

vi.mock("server-only", () => ({}));
vi.mock("./moxfieldUserAgent", () => ({ getUserAgent: vi.fn(async () => "test-agent") }));

let fetchMock: ReturnType<typeof vi.fn>;
// when each request reached "Moxfield", on the fake clock
let startedAt: number[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.unstubAllEnvs();
  startedAt = [];
  fetchMock = vi.fn(async () => {
    startedAt.push(Date.now());
    return new Response("{}", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("moxfieldFetch spacing", () => {
  it("waits a full second before the first call by default", async () => {
    const call = moxfieldFetch("https://api2.moxfield.com/v1/startup/authenticated");
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await call;
  });

  it("makes every kind of call wait a second after it was asked for", async () => {
    // a token refresh, then an authenticated call, then a delete
    for (const url of [
      "https://api2.moxfield.com/v1/startup/authenticated",
      "https://api2.moxfield.com/v3/decks",
      "https://api2.moxfield.com/v1/decks/abc",
    ]) {
      const askedAt = Date.now();
      const call = moxfieldFetch(url, { method: "POST" });
      await vi.advanceTimersByTimeAsync(5000);
      await call;
      expect(startedAt[startedAt.length - 1] - askedAt).toBeGreaterThanOrEqual(1000);
    }
    expect(startedAt).toHaveLength(3);
  });

  it("uses MOXFIELD_DELAY_MS when it is set", async () => {
    vi.stubEnv("MOXFIELD_DELAY_MS", "250");
    const call = moxfieldFetch("https://api2.moxfield.com/v3/decks");
    await vi.advanceTimersByTimeAsync(249);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await call;
  });

  it.each(["abc", "-5", "NaN"])("falls back to a second when MOXFIELD_DELAY_MS is %s", async (value) => {
    vi.stubEnv("MOXFIELD_DELAY_MS", value);
    const call = moxfieldFetch("https://api2.moxfield.com/v3/decks");
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await call;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("moxfieldFetch requests", () => {
  it("sends the stored User-Agent and keeps the caller's headers", async () => {
    const call = moxfieldFetch("https://api2.moxfield.com/v3/decks", {
      method: "POST",
      headers: { Authorization: "Bearer abc" },
    });
    await vi.advanceTimersByTimeAsync(1000);
    await call;
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("User-Agent")).toBe("test-agent");
    expect(headers.get("Authorization")).toBe("Bearer abc");
    expect(init.method).toBe("POST");
  });

  it("stops with the rate-limit error on a 429, without retrying", async () => {
    fetchMock.mockImplementation(async () => {
      startedAt.push(Date.now());
      return new Response("slow down", { status: 429 });
    });
    const call = moxfieldFetch("https://api2.moxfield.com/v3/decks");
    const outcome = expect(call).rejects.toBeInstanceOf(MoxfieldRateLimitedError);
    await vi.advanceTimersByTimeAsync(5000);
    await outcome;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("turns a network failure into a readable error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const call = moxfieldFetch("https://api2.moxfield.com/v3/decks");
    const outcome = expect(call).rejects.toThrow("Could not reach Moxfield");
    await vi.advanceTimersByTimeAsync(1000);
    await outcome;
  });
});
