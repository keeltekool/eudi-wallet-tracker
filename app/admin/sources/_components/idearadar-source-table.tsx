"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type Source = {
  id: number;
  name: string;
  url: string;
  type: string;
  config: Record<string, unknown> | null;
  active: boolean;
  lastScrapedAt: string | null;
  lastProjectCount: number | null;
  acceptanceRate: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type Props = {
  sources: Source[];
  lastRunDate: string | null;
};

const TYPE_BADGE: Record<string, string> = {
  producthunt: "bg-orange-50 text-orange-700",
  github: "bg-gray-100 text-gray-700",
  hackernews: "bg-amber-50 text-amber-700",
  devto: "bg-indigo-50 text-indigo-700",
  reddit: "bg-red-50 text-red-700",
  rss: "bg-blue-50 text-blue-700",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function IdearadarSourceTable({ sources, lastRunDate }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState(false);

  const types = useMemo(
    () => [...new Set(sources.map((s) => s.type))].sort(),
    [sources]
  );

  const filtered = useMemo(() => {
    if (typeFilter === "all") return sources;
    return sources.filter((s) => s.type === typeFilter);
  }, [sources, typeFilter]);

  const stats = useMemo(() => {
    const active = sources.filter((s) => s.active).length;
    const scraped = sources.filter((s) => s.lastScrapedAt).length;
    return { total: sources.length, active, scraped, never: sources.length - scraped };
  }, [sources]);

  const allSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((s) => s.id)));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkAction(action: "delete" | "pause" | "resume") {
    setActionLoading(true);
    await fetch("/api/sources/bulk-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], action, project: "idearadar" }),
    });
    setSelected(new Set());
    setActionLoading(false);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Idea Radar Sources</h1>
            <p className="text-sm text-gray-500 mt-1">
              {sources.length} feed source{sources.length === 1 ? "" : "s"} configured
              {lastRunDate && <> · Last scrape {timeAgo(lastRunDate)}</>}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {([
            { label: "Total", value: stats.total, color: "text-gray-900" },
            { label: "Active", value: stats.active, color: "text-emerald-600" },
            { label: "Scraped", value: stats.scraped, color: "text-blue-600" },
            { label: "Never scraped", value: stats.never, color: "text-gray-400" },
          ] as const).map((card) => (
            <div key={card.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 ml-2">
            {filtered.length} of {sources.length} shown
          </span>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => bulkAction("pause")} disabled={actionLoading}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50">
                Pause
              </button>
              <button onClick={() => bulkAction("resume")} disabled={actionLoading}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50">
                Resume
              </button>
              <button onClick={() => bulkAction("delete")} disabled={actionLoading}
                className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50">
                Delete
              </button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="border border-gray-200 rounded-xl bg-white px-6 py-12 text-center">
            <p className="text-sm text-gray-500">No sources configured yet.</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">URL / Config</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Active</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Accept %</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Last Scraped</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Items</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((source) => (
                  <tr key={source.id}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${!source.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(source.id)} onChange={() => toggleOne(source.id)} className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{source.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[source.type] || "bg-gray-100 text-gray-600"}`}>
                        {source.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a href={source.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2 truncate block max-w-[280px]"
                        title={source.url}>
                        {source.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 50)}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${source.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {source.active ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {source.acceptanceRate !== null ? `${source.acceptanceRate.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {timeAgo(source.lastScrapedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {source.lastProjectCount ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
