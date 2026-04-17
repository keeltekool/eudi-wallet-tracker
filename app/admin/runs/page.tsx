import { getSelectedProject } from "@/src/lib/project-context";
import { EudiRunsView } from "./_components/eudi-runs-view";
import { AllekirjoitusRunsView } from "./_components/allekirjoitus-runs-view";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const projectId = await getSelectedProject();

  if (projectId === "eudi") {
    return <EudiRunsView />;
  }

  return <AllekirjoitusRunsView />;
}
