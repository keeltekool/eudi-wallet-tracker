import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SourceForm } from "./source-form";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [source] = await db
    .select()
    .from(sources)
    .where(eq(sources.id, parseInt(id)));

  if (!source) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back to sources
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-6">{source.name}</h1>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <SourceForm source={source} />
        </div>
      </div>
    </div>
  );
}
