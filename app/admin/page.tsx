import { getSelectedProject } from "@/src/lib/project-context";
import { EudiSourcesView } from "./sources/_components/eudi-sources-view";
import { AllekirjoitusSourcesView } from "./sources/_components/allekirjoitus-sources-view";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const projectId = await getSelectedProject();

  if (projectId === "eudi") {
    return <EudiSourcesView />;
  }

  return <AllekirjoitusSourcesView />;
}
