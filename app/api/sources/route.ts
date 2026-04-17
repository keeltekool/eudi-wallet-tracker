import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";
import { getDbForProject } from "@/src/lib/db/connections";
import { sources as allekirjoitusSources } from "@/src/db/schema-allekirjoitus";

const ALLEKIRJOITUS_THEMES = [
  "pricing",
  "features",
  "integrations",
  "eid",
  "compliance",
  "market",
  "eudi-wallet",
] as const;

type AllekirjoitusBody = {
  competitor?: unknown;
  url?: unknown;
  theme?: unknown;
  purpose?: unknown;
  active?: unknown;
};

function validateAllekirjoitusPayload(body: AllekirjoitusBody):
  | { ok: true; value: { competitor: string; url: string; theme: string; purpose: string | null; active: boolean } }
  | { ok: false; error: string } {
  if (!body.competitor || typeof body.competitor !== "string" || !body.competitor.trim()) {
    return { ok: false, error: "competitor is required" };
  }
  if (!body.url || typeof body.url !== "string") {
    return { ok: false, error: "url is required" };
  }
  let parsed: URL;
  try {
    parsed = new URL(body.url);
  } catch {
    return { ok: false, error: "url must be a valid URL" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "url must use https" };
  }
  if (!body.theme || typeof body.theme !== "string") {
    return { ok: false, error: "theme is required" };
  }
  if (!ALLEKIRJOITUS_THEMES.includes(body.theme as typeof ALLEKIRJOITUS_THEMES[number])) {
    return {
      ok: false,
      error: `theme must be one of: ${ALLEKIRJOITUS_THEMES.join(", ")}`,
    };
  }
  const purpose =
    typeof body.purpose === "string" && body.purpose.trim()
      ? body.purpose.trim()
      : null;
  const active = body.active === undefined ? true : Boolean(body.active);

  return {
    ok: true,
    value: {
      competitor: body.competitor.trim(),
      url: body.url.trim(),
      theme: body.theme,
      purpose,
      active,
    },
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const project = body?.project ?? "eudi";

  if (project === "eudi") {
    const [created] = await db
      .insert(sources)
      .values({
        name: body.name,
        url: body.url,
        type: body.type,
        category: body.category || null,
        config: body.config || {},
        active: body.active ?? true,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  }

  if (project === "allekirjoitus") {
    const validated = validateAllekirjoitusPayload(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const allekirjoitusDb = getDbForProject("allekirjoitus");
    const [created] = await allekirjoitusDb
      .insert(allekirjoitusSources)
      .values(validated.value)
      .returning();

    return NextResponse.json(created, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown project" }, { status: 400 });
}

// GET all sources (used by add-source duplicate check)
export async function GET() {
  const allSources = await db.select().from(sources);
  return NextResponse.json(allSources);
}
