type Props = {
  active: boolean;
  lastArticleCount: number | null;
  lastScrapedAt: Date | null;
  type: "rss" | "css";
  hasSelectors: boolean;
};

export function StatusBadge({
  active,
  lastArticleCount,
  lastScrapedAt,
  type,
  hasSelectors,
}: Props) {
  if (!active) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Paused
      </span>
    );
  }

  // CSS source with no selectors configured = needs setup, not broken
  if (type === "css" && !hasSelectors) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
        Needs setup
      </span>
    );
  }

  if (!lastScrapedAt) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
        New
      </span>
    );
  }

  if (lastArticleCount === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
        Broken
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
      Healthy
    </span>
  );
}
