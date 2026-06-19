import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDbForProject } from "@/src/lib/db/connections";
import { athletes, sports } from "@/src/db/schema-athlon";

/**
 * Athlon athletes admin API. Enforces the scope rules: official Pages or public
 * Profiles only — FAN PAGES ARE REJECTED. New athletes default to unverified
 * (vetted in admin) + active. sport_id is required (defaults to "Muu" upstream).
 */

const SURFACE_TYPES = ["official_page", "public_profile"] as const;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/õ/g, "o").replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/š/g, "s").replace(/ž/g, "z")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isFanPage(url: string): boolean {
  return /fanpage|fännileht|fan-page/i.test(url);
}

function validateFbUrl(url: string): { ok: true } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "Facebooki URL pole korrektne" };
  }
  if (parsed.protocol !== "https:") return { ok: false, error: "URL peab kasutama https" };
  if (!/(^|\.)facebook\.com$/.test(parsed.hostname)) {
    return { ok: false, error: "Peab olema facebook.com aadress" };
  }
  if (isFanPage(url)) {
    return { ok: false, error: "Fännilehed pole lubatud — ainult ametlik leht või profiil" };
  }
  return { ok: true };
}

export async function GET() {
  const db = getDbForProject("athlon");
  const rows = await db
    .select({
      id: athletes.id,
      name: athletes.name,
      slug: athletes.slug,
      sportId: athletes.sportId,
      sportName: sports.name,
      fbUrl: athletes.fbUrl,
      surfaceType: athletes.surfaceType,
      verified: athletes.verified,
      active: athletes.active,
      bio: athletes.bio,
      imageCount: athletes.imageCount,
    })
    .from(athletes)
    .innerJoin(sports, eq(athletes.sportId, sports.id))
    .orderBy(asc(athletes.name));
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const fbUrl = typeof body?.fbUrl === "string" ? body.fbUrl.trim() : "";
  const sportId = Number(body?.sportId);
  const surfaceType = body?.surfaceType;

  if (!name) return NextResponse.json({ error: "Nimi on kohustuslik" }, { status: 400 });
  if (!sportId) return NextResponse.json({ error: "Ala on kohustuslik" }, { status: 400 });
  if (!SURFACE_TYPES.includes(surfaceType)) {
    return NextResponse.json({ error: "Vigane pinnatüüp" }, { status: 400 });
  }
  const urlCheck = validateFbUrl(fbUrl);
  if (!urlCheck.ok) return NextResponse.json({ error: urlCheck.error }, { status: 400 });

  const db = getDbForProject("athlon");
  const sport = await db.select().from(sports).where(eq(sports.id, sportId));
  if (sport.length === 0) return NextResponse.json({ error: "Ala ei leitud" }, { status: 400 });

  const slug = slugify(name);
  const dup = await db.select().from(athletes).where(eq(athletes.slug, slug));
  if (dup.length > 0) return NextResponse.json({ error: "Selline sportlane on juba olemas" }, { status: 409 });

  const [created] = await db
    .insert(athletes)
    .values({
      name,
      slug,
      sportId,
      fbUrl,
      surfaceType,
      bio: typeof body.bio === "string" && body.bio.trim() ? body.bio.trim() : null,
      verified: false, // vetted in admin
      active: true,
    })
    .returning();
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: "id puudub" }, { status: 400 });

  const db = getDbForProject("athlon");
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.bio === "string") patch.bio = body.bio.trim() || null;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.verified === "boolean") patch.verified = body.verified;
  if (Number(body.sportId)) patch.sportId = Number(body.sportId);
  if (SURFACE_TYPES.includes(body.surfaceType)) patch.surfaceType = body.surfaceType;
  if (typeof body.fbUrl === "string" && body.fbUrl.trim()) {
    const urlCheck = validateFbUrl(body.fbUrl.trim());
    if (!urlCheck.ok) return NextResponse.json({ error: urlCheck.error }, { status: 400 });
    patch.fbUrl = body.fbUrl.trim();
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Midagi muuta" }, { status: 400 });

  const [updated] = await db.update(athletes).set(patch).where(eq(athletes.id, id)).returning();
  return NextResponse.json(updated);
}
