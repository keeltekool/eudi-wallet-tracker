import { getDbForProject } from "@/src/lib/db/connections";
import { sources as idearadarSources } from "@/src/db/schema-idearadar";
import { scrapeRuns } from "@/src/db/schema-idearadar";
import { desc } from "drizzle-orm";
import { IdearadarSourceTable } from "./idearadar-source-table";

export async function IdearadarSourcesView() {
  const db = getDbForProject("idearadar");

  const [rows, lastRun] = await Promise.all([
    db.select().from(idearadarSources).orderBy(desc(idearadarSources.lastScrapedAt)),
    db.select().from(scrapeRuns).orderBy(desc(scrapeRuns.startedAt)).limit(1),
  ]);

  return (
    <IdearadarSourceTable
      sources={rows.map((s) => ({
        ...s,
        config: s.config as Record<string, unknown> | null,
        lastScrapedAt: s.lastScrapedAt?.toISOString() ?? null,
        createdAt: s.createdAt?.toISOString() ?? null,
        updatedAt: s.updatedAt?.toISOString() ?? null,
      }))}
      lastRunDate={lastRun[0]?.startedAt?.toISOString() ?? null}
    />
  );
}
