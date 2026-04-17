import Link from "next/link";
import { getSelectedProject } from "@/src/lib/project-context";
import { EudiBulkImportView } from "./_components/eudi-bulk-import";
import { AllekirjoitusBulkImport } from "./_components/allekirjoitus-bulk-import";

export const dynamic = "force-dynamic";

export default async function ImportSourcesPage() {
  const projectId = await getSelectedProject();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back to sources
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-2">Bulk Import Sources</h1>
        {projectId === "eudi" ? (
          <EudiBulkImportView />
        ) : (
          <AllekirjoitusBulkImport />
        )}
      </div>
    </div>
  );
}
