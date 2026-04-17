import { BulkImportForm } from "../bulk-import-form";

/**
 * EUDI bulk import view — thin wrapper rendering the existing JSON-based
 * BulkImportForm exactly as before the multi-project migration.
 */
export function EudiBulkImportView() {
  return (
    <>
      <p className="text-sm text-gray-500 mb-6">
        Paste the JSON output from AI source research, or upload a{" "}
        <code>.json</code> file. Duplicates are detected automatically. See the
        format spec below — give it to the AI as output rules.
      </p>
      <BulkImportForm />
    </>
  );
}
