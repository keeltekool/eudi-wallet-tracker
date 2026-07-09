import { getDbForProject } from "@/src/lib/db/connections";
import { sources as eewatchSources, scrapeRuns } from "@/src/db/schema-eewatch";
import { desc } from "drizzle-orm";
import { AllekirjoitusSourceTable } from "./allekirjoitus-source-table";

export async function EewatchSourcesView() {
  const db = getDbForProject("eewatch");

  const [rows, lastRun] = await Promise.all([
    db.select().from(eewatchSources).orderBy(desc(eewatchSources.lastScrapedAt)),
    db.select().from(scrapeRuns).orderBy(desc(scrapeRuns.startedAt)).limit(1),
  ]);

  return (
    <AllekirjoitusSourceTable
      project="eewatch"
      sources={rows.map((s) => ({
        ...s,
        lastScrapedAt: s.lastScrapedAt?.toISOString() ?? null,
        createdAt: s.createdAt?.toISOString() ?? null,
        updatedAt: s.updatedAt?.toISOString() ?? null,
      }))}
      lastRunDate={lastRun[0]?.startedAt?.toISOString() ?? null}
    />
  );
}
