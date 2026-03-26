import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";

export async function POST(request: NextRequest) {
  const body = await request.json();

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

// GET all sources (used by add-source duplicate check)
export async function GET() {
  const allSources = await db.select().from(sources);
  return NextResponse.json(allSources);
}
