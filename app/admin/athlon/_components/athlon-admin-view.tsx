import { asc, desc, eq } from "drizzle-orm";
import { getDbForProject } from "@/src/lib/db/connections";
import { athletes, sports, ingestionRuns } from "@/src/db/schema-athlon";
import { AthlonAdmin } from "./athlon-admin";

/**
 * Athlon admin (federated). Manages the athlete/sport directory in Athlon's own
 * Neon via DATABASE_URL_ATHLON. Image-pool upload + full runs history are a
 * follow-on; this covers the roster + sports essentials and shows last run.
 */
export async function AthlonAdminView() {
  const db = getDbForProject("athlon");

  const [athleteRows, sportRows, lastRun] = await Promise.all([
    db
      .select({
        id: athletes.id,
        name: athletes.name,
        slug: athletes.slug,
        sportId: athletes.sportId,
        sportName: sports.name,
        fbUrl: athletes.fbUrl,
        surfaceType: athletes.surfaceType,
        verified: athletes.verified,
        active: athletes.active,
        imageCount: athletes.imageCount,
      })
      .from(athletes)
      .innerJoin(sports, eq(athletes.sportId, sports.id))
      .orderBy(asc(athletes.name)),
    db.select().from(sports).orderBy(asc(sports.sortOrder), asc(sports.name)),
    db.select().from(ingestionRuns).orderBy(desc(ingestionRuns.startedAt)).limit(1),
  ]);

  return (
    <AthlonAdmin
      athletes={athleteRows}
      sports={sportRows.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        sortOrder: s.sortOrder ?? 0,
        isDefault: s.isDefault,
      }))}
      lastRunDate={lastRun[0]?.startedAt?.toISOString() ?? null}
    />
  );
}
