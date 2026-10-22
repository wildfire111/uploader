// is.gd refuses a link longer than this
const MAX_LENGTH = 5000;

// the shortener is open to anyone on the public page, so it only takes this site's own share links
export function isShareLink(link: string, host: string | null): boolean {
  if (link.length > MAX_LENGTH) {
    return false;
  }
  try {
    const url = new URL(link);
    return url.host === host && url.pathname === "/sideboard" && url.hash.startsWith("#plan=");
  } catch {
    return false;
  }
}

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const NAME_PREFIX = "thoughtcast";
const SUFFIX_LENGTH = 6;

// "thoughtcast" and six random base62 characters, the usual shape for a short id (62^6 is 56 billion)
export function randomShortName(): string {
  let suffix = "";
  while (suffix.length < SUFFIX_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(SUFFIX_LENGTH))) {
      // 248 is the largest multiple of 62 that fits in a byte, so every character is equally likely
      if (byte < 248 && suffix.length < SUFFIX_LENGTH) {
        suffix += ALPHABET[byte % 62];
      }
    }
  }
  return NAME_PREFIX + suffix;
}
