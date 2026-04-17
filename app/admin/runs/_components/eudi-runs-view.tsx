import { db } from "@/src/db/client";
import { scrapeRuns } from "@/src/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import type { ScrapeError } from "@/src/db/schema";

/**
 * EUDI runs history view — preserves the original runs page verbatim.
 */
export async function EudiRunsView() {
  const runs = await db
    .select()
    .from(scrapeRuns)
    .orderBy(desc(scrapeRuns.startedAt))
    .limit(20);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back to sources
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-6">Scrape Runs</h1>

        {runs.length === 0 ? (
          <p className="text-gray-500">No scrape runs yet.</p>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Started
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Sources
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    New Articles
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Errors
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const errors = (run.errors || []) as ScrapeError[];
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
                        {run.sourcesScraped}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {run.articlesFound}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {errors.length > 0 ? (
                          <span
                            className="text-amber-600 cursor-help"
                            title={errors
                              .map((e) => `${e.sourceName}: ${e.error}`)
                              .join("\n")}
                          >
                            {errors.length}
                          </span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {duration !== null ? `${duration}s` : "—"}
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
