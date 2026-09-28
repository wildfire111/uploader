import "server-only";
import { MoxfieldRateLimitedError } from "./moxfieldErrors";
import { getUserAgent } from "./moxfieldUserAgent";

const REQUEST_TIMEOUT_MS = 30_000;
// moxfield asks for at most one request per second
const DEFAULT_DELAY_MS = 1000;

export const MOXFIELD_API = "https://api2.moxfield.com";

function delayMs(): number {
  const raw = process.env.MOXFIELD_DELAY_MS;
  if (!raw) {
    return DEFAULT_DELAY_MS;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DELAY_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function moxfieldFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const userAgent = await getUserAgent();

  await sleep(delayMs());

  const headers = new Headers(init.headers);
  headers.set("User-Agent", userAgent);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Could not reach Moxfield (network error or timeout).");
  }

  if (response.status === 429) {
    throw new MoxfieldRateLimitedError();
  }
  return response;
}

export async function readBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 200);
  }
}
