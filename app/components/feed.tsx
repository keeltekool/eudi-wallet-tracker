"use client";

import { useState, useMemo } from "react";
import {
  RawArticleCard,
  CuratedArticleCard,
  type Article,
} from "./article-card";

type Props = {
  articles: Article[];
  variant: "raw" | "curated";
};

function formatCycleDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getCycleKey(article: Article): string {
  const date = article.publishedAt
    ? new Date(article.publishedAt)
    : new Date(article.scrapedAt);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function Feed({ articles, variant }: Props) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const sourcesForFilter = useMemo(
    () => [...new Set(articles.map((a) => a.sourceName))].sort(),
    [articles]
  );

  // Categories only available on curated variant
  const categories = useMemo(() => {
    if (variant !== "curated") return [];
    return [
      ...new Set(
        articles.flatMap((a) => (a.categories as string[]) || [])
      ),
    ].sort();
  }, [articles, variant]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (selectedSource && a.sourceName !== selectedSource) return false;
      if (
        variant === "curated" &&
        selectedCategory &&
        !(a.categories || []).includes(selectedCategory)
      )
        return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = a.title.toLowerCase().includes(q);
        const matchSummary =
          variant === "curated" && a.summary?.toLowerCase().includes(q);
        if (!matchTitle && !matchSummary) return false;
      }
      return true;
    });
  }, [articles, selectedSource, selectedCategory, searchQuery, variant]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Article[]>();
    for (const article of filtered) {
      const key = getCycleKey(article);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(article);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const CardComponent =
    variant === "curated" ? CuratedArticleCard : RawArticleCard;

  return (
    <div>
      {/* Filters */}
      <div className="mb-8 space-y-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search articles..."
          className="w-full px-4 py-2.5 bg-white border border-[#E3E0D9] rounded-xl text-sm text-[#1A1A2E] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
        />

        {/* Category pills — curated only */}
        {variant === "curated" && categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSelectedSource(null);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                !selectedCategory && !selectedSource
                  ? "bg-[#1A1A2E] text-white"
                  : "bg-white border border-[#E3E0D9] text-[#4A5568] hover:border-[#C9C5BC]"
              }`}
            >
              All ({articles.length})
            </button>
            {categories.map((cat) => {
              const count = articles.filter((a) =>
                (a.categories || []).includes(cat)
              ).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(
                      selectedCategory === cat ? null : cat
                    );
                    setSelectedSource(null);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? "bg-[#1A1A2E] text-white"
                      : "bg-white border border-[#E3E0D9] text-[#4A5568] hover:border-[#C9C5BC]"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Source filter — all variants */}
        {sourcesForFilter.length > 1 && (
          <select
            value={selectedSource || ""}
            onChange={(e) => {
              setSelectedSource(e.target.value || null);
              setSelectedCategory(null);
            }}
            className="px-3 py-1.5 bg-white border border-[#E3E0D9] rounded-lg text-xs text-[#4A5568] focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]"
          >
            <option value="">All sources</option>
            {sourcesForFilter.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-[#94A3B8] mb-4">
        {filtered.length} article{filtered.length === 1 ? "" : "s"}
        {selectedCategory && ` in ${selectedCategory}`}
        {selectedSource && ` from ${selectedSource}`}
        {searchQuery && ` matching "${searchQuery}"`}
      </p>

      {/* Feed */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-[#94A3B8]">
          <p className="text-lg">No articles yet</p>
          <p className="text-sm mt-1">
            Articles will appear after the pipeline runs.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([dateKey, groupArticles]) => (
            <section key={dateKey}>
              <h2
                className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-3 pb-2 border-b border-[#E3E0D9]"
                style={{ fontFamily: "var(--font-label)" }}
              >
                {formatCycleDate(new Date(dateKey))}
              </h2>
              <div className="space-y-3">
                {groupArticles.map((article) => (
                  <CardComponent key={article.id} article={article} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
