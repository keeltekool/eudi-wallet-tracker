import { getDbForProject } from "@/src/lib/db/connections";
import { sources as idearadarSources } from "@/src/db/schema-idearadar";
import { desc, eq } from "drizzle-orm";
import { IdearadarYoutubeSourceTable } from "./idearadar-youtube-source-table";

export async function IdearadarYoutubeSourcesView() {
  const db = getDbForProject("idearadar-youtube");

  const rows = await db
    .select()
    .from(idearadarSources)
    .where(eq(idearadarSources.type, "youtube"))
    .orderBy(desc(idearadarSources.lastScrapedAt));

  return (
    <IdearadarYoutubeSourceTable
      sources={rows.map((s) => ({
        ...s,
        config: s.config as Record<string, unknown> | null,
        lastScrapedAt: s.lastScrapedAt?.toISOString() ?? null,
        createdAt: s.createdAt?.toISOString() ?? null,
        updatedAt: s.updatedAt?.toISOString() ?? null,
      }))}
    />
  );
}
