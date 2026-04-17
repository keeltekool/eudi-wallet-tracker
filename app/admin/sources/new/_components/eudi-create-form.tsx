import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";
import { AddSourceForm } from "../add-source-form";

/**
 * EUDI create source view — verbatim lift of the pre-multi-project
 * `app/admin/sources/new/page.tsx` body. Kept byte-identical so the
 * `project=eudi` path behaves exactly as it always has.
 */
export async function EudiCreateSourceView() {
  // Pass existing URLs to the client for duplicate detection
  const existingSources = await db
    .select({ url: sources.url, name: sources.name })
    .from(sources);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <AddSourceForm existingSources={existingSources} />
    </div>
  );
}
