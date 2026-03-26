/* eslint-disable @next/next/no-img-element */

type Article = {
  id: number;
  title: string;
  url: string;
  publishedAt: Date | null;
  scrapedAt: Date;
  summary: string | null;
  relevanceScore: number | null;
  categories: string[] | null;
  status: "pending" | "accepted" | "rejected";
  sourceName: string;
  author: string | null;
};

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  regulation: { text: "#7B3F00", bg: "#FFF4E6", border: "#F59E0B" },
  "technical-standards": { text: "#0D4F4F", bg: "#E6F5F5", border: "#0D9488" },
  "national-implementation": { text: "#1A1A2E", bg: "#E8E8F4", border: "#6366F1" },
  industry: { text: "#374151", bg: "#F3F4F6", border: "#6B7280" },
  "security-privacy": { text: "#7C2D12", bg: "#FEF2F2", border: "#EF4444" },
  interoperability: { text: "#3730A3", bg: "#EEF2FF", border: "#818CF8" },
  "market-analysis": { text: "#065F46", bg: "#ECFDF5", border: "#10B981" },
};

function getFaviconUrl(articleUrl: string): string {
  try {
    const domain = new URL(articleUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return "";
  }
}

function getPrimaryCategory(categories: string[]): string | null {
  return categories.length > 0 ? categories[0] : null;
}

export function ArticleCard({ article }: { article: Article }) {
  const categories = (article.categories || []) as string[];
  const date = article.publishedAt || article.scrapedAt;
  const primaryCat = getPrimaryCategory(categories);
  const borderColor = primaryCat
    ? CATEGORY_COLORS[primaryCat]?.border || "#E3E0D9"
    : "#E3E0D9";
  const faviconUrl = getFaviconUrl(article.url);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white border border-[#E3E0D9] rounded-xl overflow-hidden hover:translate-y-[-1px] hover:shadow-[0_4px_20px_rgba(26,26,46,0.06)] transition-all duration-200"
      style={{ borderLeftWidth: "3px", borderLeftColor: borderColor }}
    >
      <div className="px-5 py-4">
        {/* Categories + score */}
        {(categories.length > 0 || (article.relevanceScore && article.relevanceScore >= 8)) && (
          <div className="flex items-center gap-2 mb-2">
            {categories.map((cat) => {
              const colors = CATEGORY_COLORS[cat] || {
                text: "#374151",
                bg: "#F3F4F6",
                border: "#6B7280",
              };
              return (
                <span
                  key={cat}
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    color: colors.text,
                    backgroundColor: colors.bg,
                    fontFamily: "var(--font-label)",
                  }}
                >
                  {cat}
                </span>
              );
            })}
            {article.relevanceScore && article.relevanceScore >= 8 && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFD166] text-[#1A1A2E]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {article.relevanceScore}/10
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <h3
          className="text-base font-bold text-[#1A1A2E] leading-snug line-clamp-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {article.title}
        </h3>

        {/* Summary */}
        {article.summary && (
          <p
            className="mt-1.5 text-sm text-[#4A5568] leading-relaxed line-clamp-2"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {article.summary}
          </p>
        )}

        {/* Footer: favicon + source · author · date */}
        <div
          className="mt-3 flex items-center gap-1.5 text-[11px] text-[#94A3B8]"
          style={{ fontFamily: "var(--font-label)" }}
        >
          {faviconUrl && (
            <img
              src={faviconUrl}
              alt=""
              width={14}
              height={14}
              className="rounded-sm"
              loading="lazy"
            />
          )}
          <span className="font-medium text-[#4A5568]">
            {article.sourceName}
          </span>
          {article.author && (
            <>
              <span>·</span>
              <span>{article.author}</span>
            </>
          )}
          <span>·</span>
          <span>
            {date
              ? new Date(date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "No date"}
          </span>
        </div>
      </div>
    </a>
  );
}
