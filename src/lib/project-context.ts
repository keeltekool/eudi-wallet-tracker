import { cookies } from "next/headers";
import type { ProjectId } from "./db/connections";

const COOKIE_NAME = "selected_project_id";
const KNOWN_PROJECTS: readonly ProjectId[] = ["eudi", "allekirjoitus"] as const;
const DEFAULT_PROJECT: ProjectId = "eudi";

/**
 * Reads the selected project from the admin session cookie. Server components / route handlers only.
 * Falls back to "eudi" on missing or unknown cookie values (safe default — EUDI is the existing project).
 */
export async function getSelectedProject(): Promise<ProjectId> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return DEFAULT_PROJECT;
  if ((KNOWN_PROJECTS as readonly string[]).includes(raw)) {
    return raw as ProjectId;
  }
  return DEFAULT_PROJECT;
}

export const PROJECT_COOKIE_NAME = COOKIE_NAME;
