/**
 * Same-story key for scrape-time duplicate marking: lower-case, trailing " - Source" removed (Google News and
 * Rss.app append it), non-letters/digits stripped, first 60 characters. Keys under 25 characters come back ""
 * (no key): bare release tags ("v0.9.1") and short blog titles collide across unrelated items.
 */
export function titleKey(title: string): string {
  const key = title
    .toLowerCase()
    .replace(/\s+-\s+[^-]*$/, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .slice(0, 60);
  return key.length < 25 ? "" : key;
}
