import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as eudiSchema from "../../db/schema";
import * as allekirjoitusSchema from "../../db/schema-allekirjoitus";
import * as idearadarSchema from "../../db/schema-idearadar";
import * as athlonSchema from "../../db/schema-athlon";
import * as eewatchSchema from "../../db/schema-eewatch";

export type ProjectId = "eudi" | "allekirjoitus" | "idearadar" | "athlon" | "eewatch";

const ENV_VAR_BY_PROJECT: Record<ProjectId, string> = {
  eudi: "DATABASE_URL",
  allekirjoitus: "DATABASE_URL_ALLEKIRJOITUS",
  idearadar: "DATABASE_URL_IDEARADAR",
  athlon: "DATABASE_URL_ATHLON",
  eewatch: "DATABASE_URL_EEWATCH",
};

const SCHEMA_BY_PROJECT = {
  eudi: eudiSchema,
  allekirjoitus: allekirjoitusSchema,
  idearadar: idearadarSchema,
  athlon: athlonSchema,
  eewatch: eewatchSchema,
} as const;

export function getDbForProject(projectId: ProjectId) {
  if (!(projectId in ENV_VAR_BY_PROJECT)) {
    throw new Error(`Unknown project: ${projectId}`);
  }
  const envVar = ENV_VAR_BY_PROJECT[projectId];
  const url = process.env[envVar];
  if (!url) {
    throw new Error(`${envVar} is not set in environment.`);
  }
  const schema = SCHEMA_BY_PROJECT[projectId];
  return drizzle(neon(url), { schema });
}

/** Returns the list of known project IDs. Used by /api/projects. */
export function listKnownProjects(): ProjectId[] {
  return Object.keys(ENV_VAR_BY_PROJECT) as ProjectId[];
}
