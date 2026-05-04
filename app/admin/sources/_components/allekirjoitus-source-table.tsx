"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Source = {
  id: number;
  competitor: string;
  url: string;
  theme: string;
  purpose: string | null;
  active: boolean;
  lastScrapedAt: string | null;
  lastStatus: string | null;
  lastContentHash: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type Status = "active" | "changed" | "failed" | "pending";

type Props = {
  sources: Source[];
  lastRunDate: string | null;
};

const THEME_BADGE: Record<string, string> = {
  pricing: "bg-emerald-50 text-emerald-700",
  features: "bg-blue-50 text-blue-700",
  integrations: "bg-indigo-50 text-indigo-700",
  eid: "bg-purple-50 text-purple-700",
  compliance: "bg-amber-50 text-amber-700",
  market: "bg-sky-50 text-sky-700",
  "eudi-wallet": "bg-violet-50 text-violet-700",
};

const STATUS_BADGE: Record<Status, string> = {
  active: "bg-emerald-50 text-emerald-700",
  changed: "bg-blue-50 text-blue-700",
  failed: "bg-red-50 text-red-700",
  pending: "bg-gray-100 text-gray-500",
};

const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  changed: "Changed",
  failed: "Failed",
  pending: "Pending",
};

function getStatus(s: Source): Status {
  if (!s.lastScrapedAt) return "pending";
  if (s.lastStatus && s.lastStatus !== "ok") return "failed";
  return "active";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function AllekirjoitusSourceTable({ sources, lastRunDate }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [competitorFilter, setCompetitorFilter] = useState<string>("all");
  const [themeFilter, setThemeFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const competitors = useMemo(
    () => [...new Set(sources.map((s) => s.competitor))].sort(),
    [sources]
  );
  const themes = useMemo(
    () => [...new Set(sources.map((s) => s.theme))].sort(),
    [sources]
  );

  const enriched = useMemo(
    () => sources.map((s) => ({ ...s, status: getStatus(s) })),
    [sources]
  );

  const filtered = useMemo(() => {
    return enriched.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (competitorFilter !== "all" && s.competitor !== competitorFilter) return false;
      if (themeFilter !== "all" && s.theme !== themeFilter) return false;
      return true;
    });
  }, [enriched, statusFilter, competitorFilter, themeFilter]);

  const stats = useMemo(() => {
    const s = { total: enriched.length, active: 0, changed: 0, failed: 0, pending: 0 };
    for (const e of enriched) s[e.status]++;
    return s;
  }, [enriched]);

  const allSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
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
    if (action === "delete" && !confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setActionLoading(true);
    setConfirmDelete(false);
    await fetch("/api/sources/bulk-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], action, project: "allekirjoitus" }),
    });
    setSelected(new Set());
    setActionLoading(false);
    router.refresh();
  }

  function exportUrls() {
    const urls = filtered.map((s) => s.url).join("\n");
    navigator.clipboard.writeText(urls);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Sources</h1>
            <p className="text-sm text-gray-500 mt-1">
              {sources.length} competitor URL{sources.length === 1 ? "" : "s"} tracked
              {lastRunDate && (
                <>
                  {" · "}Last scan {timeAgo(lastRunDate)}
                </>
              )}
              {" · "}
              <Link href="/admin/runs" className="text-gray-900 underline underline-offset-2">
                Run history
              </Link>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportUrls}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Export URLs
            </button>
            <Link
              href="/admin/sources/import"
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Bulk import
            </Link>
            <Link
              href="/admin/sources/new"
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Add source
            </Link>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {([
            { label: "Total", value: stats.total, color: "text-gray-900" },
            { label: "Active", value: stats.active, color: "text-emerald-600" },
            { label: "Changed", value: stats.changed, color: "text-blue-600" },
            { label: "Failed", value: stats.failed, color: "text-red-600" },
            { label: "Pending", value: stats.pending, color: "text-gray-400" },
          ] as const).map((card) => (
            <div key={card.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="changed">Changed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={competitorFilter}
            onChange={(e) => setCompetitorFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All competitors</option>
            {competitors.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={themeFilter}
            onChange={(e) => setThemeFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All themes</option>
            {themes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 ml-2">
            {filtered.length} of {sources.length} shown
          </span>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => bulkAction("pause")}
                disabled={actionLoading}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Pause
              </button>
              <button
                onClick={() => bulkAction("resume")}
                disabled={actionLoading}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Resume
              </button>
              <button
                onClick={() => bulkAction("delete")}
                disabled={actionLoading}
                className={`px-3 py-1 rounded transition-colors disabled:opacity-50 ${
                  confirmDelete
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {confirmDelete ? "Confirm delete" : "Delete"}
              </button>
              {confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="border border-gray-200 rounded-xl bg-white px-6 py-12 text-center">
            <p className="text-sm text-gray-500">
              {sources.length === 0
                ? "No sources yet. Add your first competitor URL."
                : "No sources match the current filters."}
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Competitor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">URL</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Theme</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Last Scraped</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((source) => (
                  <tr
                    key={source.id}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${
                      !source.active ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(source.id)}
                        onChange={() => toggleOne(source.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {source.competitor}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2 truncate block max-w-[320px]"
                        title={source.url}
                      >
                        {source.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          THEME_BADGE[source.theme] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {source.theme}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_BADGE[source.status]
                        }`}
                      >
                        {STATUS_LABEL[source.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {timeAgo(source.lastScrapedAt)}
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
