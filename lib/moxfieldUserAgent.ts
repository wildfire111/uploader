import "server-only";
import { MoxfieldUserAgentMissingError } from "./moxfieldErrors";
import { encryptionKey } from "./moxfieldKey";
import { getConnectionRow, saveUserAgent } from "./queries/moxfieldConnection";
import { decryptSecret, encryptSecret } from "./secretBox";
import { cleanUserAgent } from "./userAgent";

export async function getUserAgent(): Promise<string> {
  const row = await getConnectionRow();
  if (!row?.encryptedUserAgent) {
    throw new MoxfieldUserAgentMissingError();
  }
  try {
    return decryptSecret(row.encryptedUserAgent, encryptionKey());
  } catch (error) {
    console.error(
      `Stored Moxfield User-Agent is unreadable: ${error instanceof Error ? error.message : error}`
    );
    throw new MoxfieldUserAgentMissingError();
  }
}

export type SetUserAgentResult = { ok: true } | { ok: false; error: string };

export async function setMoxfieldUserAgent(
  raw: string,
  adminEmail: string
): Promise<SetUserAgentResult> {
  const cleaned = cleanUserAgent(raw);
  if (!cleaned.ok) {
    return cleaned;
  }
  await saveUserAgent(encryptSecret(cleaned.value, encryptionKey()), adminEmail);
  return { ok: true };
}

export type MoxfieldUserAgentStatus = {
  set: boolean;
  updatedBy: string | null;
  updatedAt: Date | null;
};

export async function getMoxfieldUserAgentStatus(): Promise<MoxfieldUserAgentStatus> {
  const row = await getConnectionRow();
  let set = false;
  if (row?.encryptedUserAgent) {
    try {
      decryptSecret(row.encryptedUserAgent, encryptionKey());
      set = true;
    } catch {
      set = false;
    }
  }
  return {
    set,
    updatedBy: row?.userAgentUpdatedBy ?? null,
    updatedAt: row?.userAgentUpdatedAt ?? null,
  };
}
