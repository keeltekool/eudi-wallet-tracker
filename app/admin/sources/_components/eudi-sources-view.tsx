import { db } from "@/src/db/client";
import { sources, scrapeRuns } from "@/src/db/schema";
import { desc } from "drizzle-orm";
import { SourceTable } from "@/app/admin/components/source-table";
import { SetupCssButton } from "@/app/admin/components/setup-css-button";
import Link from "next/link";

/**
 * EUDI sources view — renders the EUDI admin source list exactly as it was
 * before the multi-project migration. The query, columns, filters, and bulk
 * actions are preserved verbatim from the original `app/admin/page.tsx`.
 */
export async function EudiSourcesView() {
  const [allSources, recentRuns] = await Promise.all([
    db.select().from(sources).orderBy(desc(sources.lastScrapedAt)),
    db
      .select()
      .from(scrapeRuns)
      .orderBy(desc(scrapeRuns.startedAt))
      .limit(1),
  ]);

  const lastRun = recentRuns[0];

  // Count CSS sources needing setup
  const needsSetupCount = allSources.filter((s) => {
    if (s.type !== "css" || !s.active) return false;
    const config = s.config as Record<string, unknown> | null;
    return !config || !config.articleSelector;
  }).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Sources</h1>
            <p className="text-sm text-gray-500 mt-1">
              {allSources.length} sources configured
              {lastRun && (
                <>
                  {" · "}Last scrape:{" "}
                  {new Date(lastRun.startedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  <Link
                    href="/admin/runs"
                    className="text-gray-900 underline underline-offset-2"
                  >
                    Run history
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-3">
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

        {/* CSS setup prompt */}
        <SetupCssButton count={needsSetupCount} />

        <SourceTable
          sources={allSources}
          allUrls={allSources.map((s) => s.url)}
        />
      </div>
    </div>
  );
}
