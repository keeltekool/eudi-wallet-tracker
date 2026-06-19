import { NextRequest, NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { getDbForProject } from "@/src/lib/db/connections";
import { sports, athletes } from "@/src/db/schema-athlon";

/**
 * Athlon sports admin API. The sports list drives athlete assignment + the
 * public filter chips. "Muu" (is_default) is permanent: it cannot be deleted
 * and is the reassignment target when any other sport is deleted.
 */

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/õ/g, "o").replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/š/g, "s").replace(/ž/g, "z")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET() {
  const db = getDbForProject("athlon");
  const rows = await db.select().from(sports).orderBy(asc(sports.sortOrder), asc(sports.name));
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nimi on kohustuslik" }, { status: 400 });

  const db = getDbForProject("athlon");
  const slug = slugify(name);
  if (!slug) return NextResponse.json({ error: "Nimi peab sisaldama tähti/numbreid" }, { status: 400 });

  const existing = await db.select().from(sports).where(eq(sports.slug, slug));
  if (existing.length > 0) return NextResponse.json({ error: "Selline ala on juba olemas" }, { status: 409 });

  // sort new sports after existing real sports but before the permanent "Muu" (9999)
  const maxRow = await db
    .select({ m: sql<number>`coalesce(max(${sports.sortOrder}), 0)` })
    .from(sports)
    .where(eq(sports.isDefault, false));
  const nextOrder = Math.min((maxRow[0]?.m ?? 0) + 1, 9000);
  const [created] = await db
    .insert(sports)
    .values({ name, slug, sortOrder: nextOrder, isDefault: false })
    .returning();
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: "id puudub" }, { status: 400 });

  const db = getDbForProject("athlon");
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim();
    patch.slug = slugify(body.name);
  }
  if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Midagi muuta" }, { status: 400 });

  const [updated] = await db.update(sports).set(patch).where(eq(sports.id, id)).returning();
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: "id puudub" }, { status: 400 });

  const db = getDbForProject("athlon");
  const target = await db.select().from(sports).where(eq(sports.id, id));
  if (target.length === 0) return NextResponse.json({ error: "Ala ei leitud" }, { status: 404 });
  if (target[0].isDefault) {
    return NextResponse.json({ error: '"Muu" ala ei saa kustutada' }, { status: 400 });
  }

  // Force-reassign this sport's athletes to "Muu", then delete the sport.
  const muu = await db.select().from(sports).where(eq(sports.isDefault, true));
  if (muu.length === 0) return NextResponse.json({ error: '"Muu" ala puudub' }, { status: 500 });
  await db.update(athletes).set({ sportId: muu[0].id }).where(eq(athletes.sportId, id));
  await db.delete(sports).where(eq(sports.id, id));

  return NextResponse.json({ ok: true, reassignedTo: muu[0].id });
}
