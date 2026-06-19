import { getDbForProject } from "@/src/lib/db/connections";
import { ingestionRuns } from "@/src/db/schema-athlon";
import { desc } from "drizzle-orm";
import Link from "next/link";

/**
 * Athlon ingestion runs history — read-only, 20 most recent runs. Columns reflect
 * the ingestion_runs shape (athletes scanned, posts found/new, images added).
 */
export async function AthlonRunsView() {
  const db = getDbForProject("athlon");
  const runs = await db
    .select()
    .from(ingestionRuns)
    .orderBy(desc(ingestionRuns.startedAt))
    .limit(20);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          &larr; Tagasi
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-6">Athlon — sissevõtu jooksud</h1>

        {runs.length === 0 ? (
          <p className="text-gray-500">Athloni ingestit pole veel käivitatud.</p>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Algus</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Kestus</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Staatus</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Skännitud</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Postitusi</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Uusi</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Pilte +</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Märkused</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const duration =
                    run.finishedAt && run.startedAt
                      ? Math.round(
                          (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
                        )
                      : null;
                  return (
                    <tr key={run.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 text-gray-900">
                        {new Date(run.startedAt).toLocaleDateString("et-EE", {
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
                                : run.status === "stopped_checkpoint"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">{run.athletesScanned ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">{run.postsFound ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        {(run.postsNew ?? 0) > 0 ? (
                          <span className="text-emerald-600">{run.postsNew}</span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">{run.imagesAdded ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[220px] truncate" title={run.notes ?? undefined}>
                        {run.notes ?? "—"}
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
