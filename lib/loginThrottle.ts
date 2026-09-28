// caps how many login emails go out per address and overall
export const WINDOW_SECONDS = 10 * 60;
export const MAX_LINKS_PER_EMAIL = 3;
export const MAX_LINKS_TOTAL = 30;

// the counts include the current request
export function isLoginLinkAllowed(counts: { forEmail: number; total: number }): boolean {
  return counts.forEmail <= MAX_LINKS_PER_EMAIL && counts.total <= MAX_LINKS_TOTAL;
}
