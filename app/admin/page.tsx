import { getSelectedProject } from "@/src/lib/project-context";
import { EudiSourcesView } from "./sources/_components/eudi-sources-view";
import { AllekirjoitusSourcesView } from "./sources/_components/allekirjoitus-sources-view";
import { IdearadarSourcesView } from "./sources/_components/idearadar-sources-view";
import { AthlonAdminView } from "./athlon/_components/athlon-admin-view";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const projectId = await getSelectedProject();

  if (projectId === "eudi") {
    return <EudiSourcesView />;
  }

  if (projectId === "idearadar") {
    return <IdearadarSourcesView />;
  }

  if (projectId === "athlon") {
    return <AthlonAdminView />;
  }

  return <AllekirjoitusSourcesView />;
}
