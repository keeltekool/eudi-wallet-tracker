import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";
import Link from "next/link";
import { AddSourceForm } from "./add-source-form";

export const dynamic = "force-dynamic";

export default async function NewSourcePage() {
  // Pass existing URLs to the client for duplicate detection
  const existingSources = await db
    .select({ url: sources.url, name: sources.name })
    .from(sources);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back to sources
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-6">Add Source</h1>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <AddSourceForm existingSources={existingSources} />
        </div>
      </div>
    </div>
  );
}
