"use client";

import { useState, useMemo } from "react";
import { ArticleCard } from "./article-card";

type Article = {
  id: number;
  title: string;
  url: string;
  publishedAt: Date | null;
  scrapedAt: Date;
  summary: string | null;
  relevanceScore: number | null;
  categories: string[] | null;
  status: "pending" | "relevant" | "irrelevant" | "accepted" | "rejected";
  sourceName: string;
  author: string | null;
};

type Props = {
  articles: Article[];
  categories: string[];
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
  // Group by scrape date (day), since scrapes happen twice per week
  const date = article.publishedAt
    ? new Date(article.publishedAt)
    : new Date(article.scrapedAt);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function Feed({ articles, categories }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    null
  );
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Unique sources for filter
  const sourcesForFilter = useMemo(
    () => [...new Set(articles.map((a) => a.sourceName))].sort(),
    [articles]
  );

  // Filter articles
  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (
        selectedCategory &&
        !(a.categories || []).includes(selectedCategory)
      ) {
        return false;
      }
      if (selectedSource && a.sourceName !== selectedSource) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = a.title.toLowerCase().includes(q);
        const matchSummary = a.summary?.toLowerCase().includes(q);
        if (!matchTitle && !matchSummary) return false;
      }
      return true;
    });
  }, [articles, selectedCategory, selectedSource, searchQuery]);

  // Group by cycle (date)
  const grouped = useMemo(() => {
    const groups = new Map<string, Article[]>();
    for (const article of filtered) {
      const key = getCycleKey(article);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(article);
    }
    // Sort by date descending
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <div>
      {/* Filters */}
      <div className="mb-8 space-y-3">
        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search articles..."
          className="w-full px-4 py-2.5 bg-white border border-[#E3E0D9] rounded-xl text-sm text-[#1A1A2E] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1A1A2E] focus:border-transparent"
        />

        {/* Category + Source filters */}
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

        {/* Source filter */}
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

      {/* Results count */}
      <p className="text-xs text-[#94A3B8] mb-4">
        {filtered.length} article{filtered.length === 1 ? "" : "s"}
        {selectedCategory && ` in ${selectedCategory}`}
        {selectedSource && ` from ${selectedSource}`}
        {searchQuery && ` matching "${searchQuery}"`}
      </p>

      {/* Grouped feed */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-[#94A3B8]">
          <p className="text-lg">No articles yet</p>
          <p className="text-sm mt-1">
            Articles will appear after the scraping pipeline runs.
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
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
