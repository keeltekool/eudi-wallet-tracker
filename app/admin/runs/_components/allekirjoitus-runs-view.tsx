import { getDbForProject } from "@/src/lib/db/connections";
import { scrapeRuns } from "@/src/db/schema-allekirjoitus";
import { desc } from "drizzle-orm";
import Link from "next/link";

/**
 * Allekirjoitus runs history view — read-only, 20 most recent scrape runs.
 * Columns reflect the Allekirjoitus scrape_runs shape (urls_scraped,
 * urls_failed, changes_detected, brief_updated, lcc_run_id).
 */
function truncateId(id: string | null, max = 10): string {
  if (!id) return "—";
  if (id.length <= max) return id;
  return id.slice(0, max) + "…";
}

export async function AllekirjoitusRunsView() {
  const db = getDbForProject("allekirjoitus");
  const runs = await db
    .select()
    .from(scrapeRuns)
    .orderBy(desc(scrapeRuns.startedAt))
    .limit(20);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back to sources
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-6">Scrape Runs</h1>

        {runs.length === 0 ? (
          <p className="text-gray-500">No Allekirjoitus scans yet.</p>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Started
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Duration
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    URLs scraped
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    URLs failed
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Changes
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">
                    Brief updated
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    LCC Run
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const duration =
                    run.completedAt && run.startedAt
                      ? Math.round(
                          (new Date(run.completedAt).getTime() -
                            new Date(run.startedAt).getTime()) /
                            1000
                        )
                      : null;

                  return (
                    <tr
                      key={run.id}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-4 py-3 text-gray-900">
                        {new Date(run.startedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {duration !== null ? `${duration}s` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            run.status === "success"
                              ? "bg-emerald-50 text-emerald-700"
                              : run.status === "failed"
                                ? "bg-red-50 text-red-700"
                                : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {run.urlsScraped ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {(run.urlsFailed ?? 0) > 0 ? (
                          <span className="text-amber-600">
                            {run.urlsFailed}
                          </span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {run.changesDetected ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {run.briefUpdated ? (
                          <span
                            className="text-emerald-600"
                            aria-label="Brief updated"
                          >
                            ✓
                          </span>
                        ) : (
                          <span className="text-gray-300" aria-label="Brief not updated">
                            —
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs text-gray-500"
                        title={run.lccRunId ?? undefined}
                      >
                        {truncateId(run.lccRunId)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
