export type RawArticle = {
  title: string;
  url: string;
  publishedAt?: Date;
  author?: string;
  fullText?: string;
};

type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validateArticle(article: RawArticle): ValidationResult {
  if (!article.title || !article.title.trim()) {
    return { valid: false, reason: "Empty or missing title" };
  }

  try {
    new URL(article.url);
  } catch {
    return { valid: false, reason: "Invalid URL" };
  }

  if (article.publishedAt) {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    if (article.publishedAt > twoDaysFromNow) {
      return { valid: false, reason: "Article is future-dated" };
    }
  }

  return { valid: true };
}
