import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";
import { getDbForProject } from "@/src/lib/db/connections";
import { sources as allekirjoitusSources } from "@/src/db/schema-allekirjoitus";
import { eq } from "drizzle-orm";

const ALLEKIRJOITUS_THEMES = [
  "pricing",
  "features",
  "integrations",
  "eid",
  "compliance",
  "market",
  "eudi-wallet",
];

function resolveProject(request: NextRequest, bodyProject?: unknown): "eudi" | "allekirjoitus" {
  const queryProject = request.nextUrl.searchParams.get("project");
  const candidate = queryProject ?? (typeof bodyProject === "string" ? bodyProject : undefined);
  if (candidate === "allekirjoitus") return "allekirjoitus";
  return "eudi";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = resolveProject(request);

  if (project === "eudi") {
    const [source] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, parseInt(id)));

    if (!source) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(source);
  }

  const allekirjoitusDb = getDbForProject("allekirjoitus");
  const [source] = await allekirjoitusDb
    .select()
    .from(allekirjoitusSources)
    .where(eq(allekirjoitusSources.id, parseInt(id)));

  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(source);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const project = resolveProject(request, body?.project);

  if (project === "eudi") {
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.url !== undefined) updateData.url = body.url;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.config !== undefined) updateData.config = body.config;
    if (body.active !== undefined) updateData.active = body.active;

    const [updated] = await db
      .update(sources)
      .set(updateData)
      .where(eq(sources.id, parseInt(id)))
      .returning();

    return NextResponse.json(updated);
  }

  // Allekirjoitus branch
  const updateData: Record<string, unknown> = {};
  if (body.competitor !== undefined) {
    if (typeof body.competitor !== "string" || !body.competitor.trim()) {
      return NextResponse.json(
        { error: "competitor must be a non-empty string" },
        { status: 400 },
      );
    }
    updateData.competitor = body.competitor.trim();
  }
  if (body.url !== undefined) {
    if (typeof body.url !== "string") {
      return NextResponse.json({ error: "url must be a string" }, { status: 400 });
    }
    let parsed: URL;
    try {
      parsed = new URL(body.url);
    } catch {
      return NextResponse.json({ error: "url must be a valid URL" }, { status: 400 });
    }
    if (parsed.protocol !== "https:") {
      return NextResponse.json({ error: "url must use https" }, { status: 400 });
    }
    updateData.url = body.url.trim();
  }
  if (body.theme !== undefined) {
    if (
      typeof body.theme !== "string" ||
      !ALLEKIRJOITUS_THEMES.includes(body.theme)
    ) {
      return NextResponse.json({ error: "invalid theme" }, { status: 400 });
    }
    updateData.theme = body.theme;
  }
  if (body.purpose !== undefined) {
    updateData.purpose =
      typeof body.purpose === "string" && body.purpose.trim()
        ? body.purpose.trim()
        : null;
  }
  if (body.active !== undefined) updateData.active = Boolean(body.active);

  const allekirjoitusDb = getDbForProject("allekirjoitus");
  const [updated] = await allekirjoitusDb
    .update(allekirjoitusSources)
    .set(updateData)
    .where(eq(allekirjoitusSources.id, parseInt(id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = resolveProject(request);

  if (project === "eudi") {
    await db.delete(sources).where(eq(sources.id, parseInt(id)));
    return NextResponse.json({ ok: true });
  }

  const allekirjoitusDb = getDbForProject("allekirjoitus");
  await allekirjoitusDb
    .delete(allekirjoitusSources)
    .where(eq(allekirjoitusSources.id, parseInt(id)));
  return NextResponse.json({ ok: true });
}
