/**
 * Same-story key for scrape-time duplicate marking: lower-case, trailing " - Source" removed (Google News and
 * Rss.app append it), non-letters/digits stripped, first 60 characters.
 */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+-\s+[^-]*$/, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .slice(0, 60);
}
