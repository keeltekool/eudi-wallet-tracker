import Link from "next/link";
import { BulkImportForm } from "./bulk-import-form";

export default function ImportSourcesPage() {
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
        <p className="text-sm text-gray-500 mb-6">
          Paste the JSON output from AI source research, or upload a{" "}
          <code>.json</code> file. Duplicates are detected automatically.
          See the format spec below — give it to the AI as output rules.
        </p>
        <BulkImportForm />
      </div>
    </div>
  );
}
