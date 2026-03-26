"use client";

import { useRouter } from "next/navigation";
import { StatusBadge } from "./status-badge";

type Source = {
  id: number;
  name: string;
  url: string;
  type: "rss" | "css";
  category: string | null;
  active: boolean;
  lastScrapedAt: Date | null;
  lastArticleCount: number | null;
};

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

export function SourceTable({ sources }: { sources: Source[] }) {
  const router = useRouter();

  const healthy = sources.filter(
    (s) => s.active && s.lastScrapedAt && s.lastArticleCount !== 0
  ).length;
  const broken = sources.filter(
    (s) => s.active && s.lastScrapedAt && s.lastArticleCount === 0
  ).length;
  const paused = sources.filter((s) => !s.active).length;
  const newSources = sources.filter(
    (s) => s.active && !s.lastScrapedAt
  ).length;
  const rssCount = sources.filter((s) => s.type === "rss").length;
  const cssCount = sources.filter((s) => s.type === "css").length;

  return (
    <div>
      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-2xl font-bold">{sources.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total sources</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-2xl font-bold text-emerald-600">{healthy}</div>
          <div className="text-xs text-gray-500 mt-0.5">Healthy</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-2xl font-bold text-amber-600">{broken}</div>
          <div className="text-xs text-gray-500 mt-0.5">Broken</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-mono text-gray-600">
              {rssCount} RSS
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-sm font-mono text-gray-600">
              {cssCount} CSS
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">By type</div>
        </div>
      </div>

      {/* Health legend */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Healthy ({healthy})
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Broken ({broken})
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          Paused ({paused})
        </div>
        {newSources > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            New ({newSources})
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                Source
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                Type
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                Category
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                Status
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                Last Scraped
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">
                Articles
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr
                key={source.id}
                onClick={() => router.push(`/admin/sources/${source.id}`)}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {source.name}
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
