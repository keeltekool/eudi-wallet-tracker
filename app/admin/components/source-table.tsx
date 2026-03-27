"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./status-badge";

type Source = {
  id: number;
  name: string;
  url: string;
  type: "rss" | "css";
  category: string | null;
  config: Record<string, unknown> | null;
  active: boolean;
  lastScrapedAt: Date | null;
  lastArticleCount: number | null;
};

type StatusType = "healthy" | "broken" | "needs-setup" | "paused" | "new";
type SortField = "name" | "status" | "lastScraped" | "articles";
type SortDir = "asc" | "desc";

function timeAgo(date: Date | null): string {
  if (!date) return "Never";
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function hasSelectors(source: Source): boolean {
  if (source.type !== "css") return true;
  const config = source.config as Record<string, unknown> | null;
  return !!(config && config.articleSelector);
}

function getStatus(source: Source): StatusType {
  if (!source.active) return "paused";
  if (source.type === "css" && !hasSelectors(source)) return "needs-setup";
  if (!source.lastScrapedAt) return "new";
  if (source.lastArticleCount === 0) return "broken";
  return "healthy";
}

const STATUS_ORDER: Record<StatusType, number> = {
  broken: 0,
  "needs-setup": 1,
  "new": 2,
  healthy: 3,
  paused: 4,
};

export function SourceTable({ sources }: { sources: Source[] }) {
  const router = useRouter();

  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusType | "all">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "rss" | "css">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Sort state — default: status (broken first)
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Stats
  const healthy = sources.filter((s) => getStatus(s) === "healthy").length;
  const broken = sources.filter((s) => getStatus(s) === "broken").length;
  const needsSetup = sources.filter((s) => getStatus(s) === "needs-setup").length;
  const paused = sources.filter((s) => getStatus(s) === "paused").length;
  const rssCount = sources.filter((s) => s.type === "rss").length;
  const cssCount = sources.filter((s) => s.type === "css").length;

  // Unique categories
  const categories = useMemo(
    () =>
      [...new Set(sources.map((s) => s.category).filter(Boolean) as string[])].sort(),
    [sources]
  );

  // Filter + sort
  const displayed = useMemo(() => {
    let result = sources.filter((s) => {
      if (statusFilter !== "all" && getStatus(s) !== statusFilter) return false;
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "status":
          cmp = STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)];
          break;
        case "lastScraped": {
          const aTime = a.lastScrapedAt ? new Date(a.lastScrapedAt).getTime() : 0;
          const bTime = b.lastScrapedAt ? new Date(b.lastScrapedAt).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
        case "articles":
          cmp = (a.lastArticleCount ?? -1) - (b.lastArticleCount ?? -1);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [sources, statusFilter, typeFilter, categoryFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "articles" || field === "lastScraped" ? "desc" : "asc");
    }
  }

  function SortArrow({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-gray-900 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const statusFilters: { value: StatusType | "all"; label: string; count: number; color: string }[] = [
    { value: "all", label: "All", count: sources.length, color: "bg-gray-500" },
    { value: "healthy", label: "Healthy", count: healthy, color: "bg-emerald-500" },
    { value: "needs-setup", label: "Needs setup", count: needsSetup, color: "bg-purple-500" },
    { value: "broken", label: "Broken", count: broken, color: "bg-amber-500" },
    { value: "paused", label: "Paused", count: paused, color: "bg-gray-400" },
  ];

  return (
    <div>
      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-2xl font-bold">{sources.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total sources</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-2xl font-bold text-emerald-600">{healthy}</div>
          <div className="text-xs text-gray-500 mt-0.5">Healthy</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-2xl font-bold text-purple-600">{needsSetup}</div>
          <div className="text-xs text-gray-500 mt-0.5">Needs setup</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-2xl font-bold text-amber-600">{broken}</div>
          <div className="text-xs text-gray-500 mt-0.5">Broken</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-mono text-gray-600">{rssCount} RSS</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm font-mono text-gray-600">{cssCount} CSS</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">By type</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Status filter pills */}
        <div className="flex gap-1">
          {statusFilters.map((f) => (
            f.count > 0 || f.value === "all" ? (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? "bg-gray-900 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === f.value ? "bg-white" : f.color}`} />
                {f.label} ({f.count})
              </button>
            ) : null
          ))}
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "all" | "rss" | "css")}
          className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-900"
        >
          <option value="all">All types</option>
          <option value="rss">RSS ({rssCount})</option>
          <option value="css">CSS ({cssCount})</option>
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-900"
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Result count */}
        {(statusFilter !== "all" || typeFilter !== "all" || categoryFilter !== "all") && (
          <span className="text-xs text-gray-400">
            {displayed.length} of {sources.length}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th
                className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none"
                onClick={() => toggleSort("name")}
              >
                Source <SortArrow field="name" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                Type
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                Category
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none"
                onClick={() => toggleSort("status")}
              >
                Status <SortArrow field="status" />
              </th>
              <th
                className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none"
                onClick={() => toggleSort("lastScraped")}
              >
                Last Scraped <SortArrow field="lastScraped" />
              </th>
              <th
                className="text-right px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-900 select-none"
                onClick={() => toggleSort("articles")}
              >
                Articles <SortArrow field="articles" />
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((source) => (
              <tr
                key={source.id}
                onClick={() => router.push(`/admin/sources/${source.id}`)}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-gray-900">
                      {source.name}
                    </div>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-400 hover:text-gray-700 transition-colors"
                      title="Open source page"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  </div>
                  <div className="text-xs text-gray-400 truncate max-w-[300px]">
                    {source.url}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-600">
                    {source.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {source.category || "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    active={source.active}
                    lastArticleCount={source.lastArticleCount}
                    lastScrapedAt={source.lastScrapedAt}
                    type={source.type}
                    hasSelectors={hasSelectors(source)}
                  />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {timeAgo(source.lastScrapedAt)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">
                  {source.lastArticleCount ?? "—"}
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No sources match the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
