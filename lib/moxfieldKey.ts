import "server-only";

export function encryptionKey(): string {
  const key = process.env.MOXFIELD_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("MOXFIELD_TOKEN_ENCRYPTION_KEY is not set on the server.");
  }
  return key;
}
