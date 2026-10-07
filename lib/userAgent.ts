
export const MAX_USER_AGENT_LENGTH = 300;

type CleanedUserAgent = { ok: true; value: string } | { ok: false; error: string };

export function cleanUserAgent(raw: string): CleanedUserAgent {
  // people paste it wrapped in quotes
  const value = raw.trim().replace(/^["']+|["']+$/g, "").trim();

  if (!value) {
    return { ok: false, error: "Paste the User-Agent first." };
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return { ok: false, error: "The User-Agent must be a single line of plain text." };
  }
  if (value.length > MAX_USER_AGENT_LENGTH) {
    return {
      ok: false,
      error: `That's too long to be a User-Agent (${value.length} characters; the limit is ${MAX_USER_AGENT_LENGTH}).`,
    };
  }
  return { ok: true, value };
}
