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

type Props = { sources: Source[] };

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function IdearadarYoutubeSourceTable({ sources }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addChannelId, setAddChannelId] = useState("");

  const stats = useMemo(() => {
    const active = sources.filter((s) => s.active).length;
    const scraped = sources.filter((s) => s.lastScrapedAt).length;
    return { total: sources.length, active, scraped };
  }, [sources]);

  const allSelected = sources.length > 0 && sources.every((s) => selected.has(s.id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sources.map((s) => s.id)));
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
      body: JSON.stringify({ ids: [...selected], action, project: "idearadar-youtube" }),
    });
    setSelected(new Set());
    setActionLoading(false);
    router.refresh();
  }

  async function addSource() {
    if (!addName.trim() || !addChannelId.trim()) return;
    setActionLoading(true);
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${addChannelId.trim()}`;
    await fetch("/api/sources/youtube-feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: "idearadar-youtube",
        name: `${addName.trim()} YouTube`,
        url: feedUrl,
        type: "youtube",
        config: { feedUrl, channelId: addChannelId.trim() },
        active: true,
      }),
    });
    setAddName("");
    setAddChannelId("");
    setShowAdd(false);
    setActionLoading(false);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Idea Radar YouTube Sources</h1>
            <p className="text-sm text-gray-500 mt-1">
              {stats.total} YouTube channel{stats.total === 1 ? "" : "s"} configured
              · {stats.active} active · {stats.scraped} scraped
            </p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
          >
            + Add Channel
          </button>
        </div>

        {showAdd && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 font-medium">Channel Name</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Cole Medin"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 font-medium">Channel ID (UC...)</label>
              <input
                type="text"
                value={addChannelId}
                onChange={(e) => setAddChannelId(e.target.value)}
                placeholder="e.g. UCMwVTLZIRRUyyVrkjDpn4pA"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <button
              onClick={addSource}
              disabled={actionLoading || !addName.trim() || !addChannelId.trim()}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}

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

        {sources.length === 0 ? (
          <div className="border border-gray-200 rounded-xl bg-white px-6 py-12 text-center">
            <p className="text-sm text-gray-500">No YouTube channels configured yet. Click "+ Add Channel" to get started.</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Channel</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Feed URL</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Active</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Last Scraped</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Videos</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${!source.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(source.id)} onChange={() => toggleOne(source.id)} className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{source.name}</td>
                    <td className="px-4 py-3">
                      <a href={source.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-gray-600 hover:text-gray-900 underline underline-offset-2 truncate block max-w-[300px]"
                        title={source.url}>
                        {source.url.replace("https://www.youtube.com/feeds/videos.xml?channel_id=", "").slice(0, 30)}...
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${source.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {source.active ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(source.lastScrapedAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{source.lastProjectCount ?? "—"}</td>
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
