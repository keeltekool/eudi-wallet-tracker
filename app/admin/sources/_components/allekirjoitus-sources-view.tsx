import { getDbForProject } from "@/src/lib/db/connections";
import { sources as allekirjoitusSources } from "@/src/db/schema-allekirjoitus";
import { desc } from "drizzle-orm";
import Link from "next/link";

/**
 * Allekirjoitus sources view — read-only list of competitor URLs.
 *
 * V1 scope: display-only. Bulk actions, toggles, and delete wiring are deferred
 * to Phase 2 Chunk E. The "Active" toggle renders as a static checkbox stub
 * here (no POST handler attached yet).
 *
 * Styling matches the existing gray-Tailwind admin chrome — no Allekirjoitus
 * branding accents leak into the EUDI-looking admin UI in this chunk.
 */

type Theme =
  | "pricing"
  | "features"
  | "integrations"
  | "eid"
  | "compliance"
  | "market"
  | "eudi-wallet";

const THEME_BADGE_CLASS: Record<Theme, string> = {
  pricing: "bg-emerald-50 text-emerald-700",
  features: "bg-blue-50 text-blue-700",
  integrations: "bg-indigo-50 text-indigo-700",
  eid: "bg-purple-50 text-purple-700",
  compliance: "bg-amber-50 text-amber-700",
  market: "bg-sky-50 text-sky-700",
  "eudi-wallet": "bg-violet-50 text-violet-700",
};

function themeBadgeClass(theme: string): string {
  if (theme in THEME_BADGE_CLASS) {
    return THEME_BADGE_CLASS[theme as Theme];
  }
  return "bg-gray-100 text-gray-600";
}

function timeAgo(date: Date | null): string {
  if (!date) return "Never";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function truncateUrl(url: string, max = 64): string {
  if (url.length <= max) return url;
  return url.slice(0, max - 1) + "…";
}

export async function AllekirjoitusSourcesView() {
  const db = getDbForProject("allekirjoitus");
  const rows = await db
    .select()
    .from(allekirjoitusSources)
    .orderBy(desc(allekirjoitusSources.lastScrapedAt));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Sources</h1>
            <p className="text-sm text-gray-500 mt-1">
              {rows.length} competitor URL{rows.length === 1 ? "" : "s"} tracked
              {" · "}
              <Link
                href="/admin/runs"
                className="text-gray-900 underline underline-offset-2"
              >
                Run history
              </Link>
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="border border-gray-200 rounded-xl bg-white px-6 py-12 text-center">
            <p className="text-sm text-gray-500">
              No Allekirjoitus sources yet. Add your first competitor URL.
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Competitor
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    URL
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Theme
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Active
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Last Scraped
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Last Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((source) => (
                  <tr
                    key={source.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {source.competitor}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[320px]">
                        <span
                          className="text-xs text-gray-600 truncate"
                          title={source.url}
                        >
                          {truncateUrl(source.url)}
                        </span>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
                          title="Open source page"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${themeBadgeClass(source.theme)}`}
                      >
                        {source.theme}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {/* Stub toggle — wiring lands in Chunk E. */}
                      <input
                        type="checkbox"
                        checked={source.active}
                        readOnly
                        aria-label={`Source ${source.competitor} active`}
                        className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {timeAgo(source.lastScrapedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {source.lastStatus ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {source.lastStatus}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
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
