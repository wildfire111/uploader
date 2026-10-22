const MAX_LENGTH = 8000;

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
