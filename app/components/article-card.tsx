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

const CATEGORY_COLORS: Record<string, { text: string; bg: string }> = {
  regulation: { text: "#7B3F00", bg: "#FFF4E6" },
  "technical-standards": { text: "#0D4F4F", bg: "#E6F5F5" },
  "national-implementation": { text: "#1A1A2E", bg: "#E8E8F4" },
  industry: { text: "#374151", bg: "#F3F4F6" },
  "security-privacy": { text: "#7C2D12", bg: "#FEF2F2" },
  interoperability: { text: "#3730A3", bg: "#EEF2FF" },
  "market-analysis": { text: "#065F46", bg: "#ECFDF5" },
};

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function ArticleCard({ article }: { article: Article }) {
  const categories = (article.categories || []) as string[];
  const date = article.publishedAt || article.scrapedAt;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white border border-[#E3E0D9] rounded-xl px-5 py-4 hover:translate-y-[-1px] hover:shadow-[0_4px_20px_rgba(26,26,46,0.06)] transition-all duration-200"
    >
      {/* Categories + score */}
      <div className="flex items-center gap-2 mb-2">
        {categories.map((cat) => {
          const colors = CATEGORY_COLORS[cat] || {
            text: "#374151",
            bg: "#F3F4F6",
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

      {/* Footer: source · time */}
      <div
        className="mt-3 flex items-center gap-1.5 text-[11px] text-[#94A3B8]"
        style={{ fontFamily: "var(--font-label)" }}
      >
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
        <span>{timeAgo(date)}</span>
      </div>
    </a>
  );
}
