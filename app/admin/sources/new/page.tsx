import Link from "next/link";
import { getSelectedProject } from "@/src/lib/project-context";
import { EudiCreateSourceView } from "./_components/eudi-create-form";
import { AllekirjoitusCreateForm } from "./_components/allekirjoitus-create-form";

export const dynamic = "force-dynamic";

export default async function NewSourcePage() {
  const projectId = await getSelectedProject();

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
        {projectId === "eudi" ? (
          <EudiCreateSourceView />
        ) : (
          <AllekirjoitusCreateForm />
        )}
      </div>
    </div>
  );
}
