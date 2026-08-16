import { db } from "@/src/db/client";
import { articles, sources, livingDoc } from "@/src/db/schema";
import { and, eq, gt, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Loop API — token-guarded endpoints for the EUDI Pipeline cloud routine.
 * Mirrors worker/src/{filter,curate,living-doc-articles,update-*}.ts so the
 * routine never needs DATABASE_URL. Auth: Bearer LOOP_TOKEN (Vercel env).
 */

function unauthorized(req: Request) {
  const token = process.env.LOOP_TOKEN;
  if (!token) return NextResponse.json({ error: "LOOP_TOKEN not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function withSourceNames<T extends { sourceId: number }>(rows: T[]) {
  const sourceIds = [...new Set(rows.map((r) => r.sourceId))];
  if (sourceIds.length === 0) return new Map<number, string>();
  const allSources = await db
    .select({ id: sources.id, name: sources.name })
    .from(sources)
    .where(inArray(sources.id, sourceIds));
  return new Map(allSources.map((s) => [s.id, s.name]));
}

export async function GET(req: Request) {
  const denied = unauthorized(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const op = url.searchParams.get("op");

  try {
    if (op === "filter") {
      const pending = await db
        .select({
          id: articles.id,
          title: articles.title,
          fullText: articles.fullText,
          sourceId: articles.sourceId,
        })
        .from(articles)
        .where(eq(articles.status, "pending"))
        .limit(100);
      const sourceMap = await withSourceNames(pending);
      return NextResponse.json({
        count: pending.length,
        articles: pending.map((a) => ({
          id: a.id,
          title: a.title,
          source: sourceMap.get(a.sourceId) || "Unknown",
          excerpt: a.fullText ? a.fullText.slice(0, 300) : null,
        })),
      });
    }

    if (op === "curate") {
      const relevant = await db
        .select({
          id: articles.id,
          title: articles.title,
          url: articles.url,
          fullText: articles.fullText,
          author: articles.author,
          publishedAt: articles.publishedAt,
          sourceId: articles.sourceId,
        })
        .from(articles)
        .where(eq(articles.status, "relevant"))
        .limit(50);
      const sourceMap = await withSourceNames(relevant);
      return NextResponse.json({
        count: relevant.length,
        articles: relevant.map((a) => ({
          id: a.id,
          title: a.title,
          url: a.url,
          source: sourceMap.get(a.sourceId) || "Unknown",
          author: a.author || null,
          publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
          excerpt: a.fullText ? a.fullText.slice(0, 500) : null,
        })),
      });
    }

    if (op === "living-doc") {
      const since = url.searchParams.get("since");
      const conditions = [eq(articles.status, "accepted")];
      if (since) conditions.push(gt(articles.scrapedAt, new Date(since)));
      const accepted = await db
        .select({
          id: articles.id,
          title: articles.title,
          url: articles.url,
          summary: articles.summary,
          categories: articles.categories,
          relevanceScore: articles.relevanceScore,
          publishedAt: articles.publishedAt,
          sourceId: articles.sourceId,
        })
        .from(articles)
        .where(and(...conditions));
      const sourceMap = await withSourceNames(accepted);
      return NextResponse.json({
        count: accepted.length,
        articles: accepted.map((a) => ({
          ...a,
          sourceId: undefined,
          source: sourceMap.get(a.sourceId) || "Unknown",
        })),
      });
    }

    if (op === "bible") {
      const [bible] = await db
        .select({ content: livingDoc.content })
        .from(livingDoc)
        .where(eq(livingDoc.section, "bible"))
        .limit(1);
      if (!bible) return NextResponse.json({ error: "Bible not found" }, { status: 404 });
      return NextResponse.json({ content: bible.content });
    }

    return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = unauthorized(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const op = body.op;

    if (op === "filter-decisions") {
      let relevant = 0, irrelevant = 0;
      for (const d of body.decisions || []) {
        if (d.status !== "relevant" && d.status !== "irrelevant") continue;
        await db.update(articles).set({ status: d.status }).where(eq(articles.id, d.id));
        if (d.status === "relevant") relevant++;
        else irrelevant++;
      }
      return NextResponse.json({ relevant, irrelevant, total: relevant + irrelevant });
    }

    if (op === "curation-decisions") {
      let accepted = 0, rejected = 0;
      for (const d of body.decisions || []) {
        if (d.status === "accepted") {
          await db
            .update(articles)
            .set({
              status: "accepted",
              relevanceScore: d.relevanceScore,
              summary: d.summary || null,
              categories: d.categories || [],
            })
            .where(eq(articles.id, d.id));
          accepted++;
        } else if (d.status === "rejected") {
          await db
            .update(articles)
            .set({
              status: "rejected",
              relevanceScore: d.relevanceScore,
              rejectionReason: d.rejectionReason || "Below relevance threshold",
            })
            .where(eq(articles.id, d.id));
          rejected++;
        }
      }
      return NextResponse.json({ accepted, rejected, total: accepted + rejected });
    }

    if (op === "living-doc-update") {
      const u = body.update;
      if (!u?.content || !u?.runDate) {
        return NextResponse.json({ error: "update.content and update.runDate required" }, { status: 400 });
      }
      await db.insert(livingDoc).values({
        section: "update",
        content: u.content,
        runDate: new Date(u.runDate),
        articlesProcessed: u.articlesProcessed ?? 0,
        sectionsTouched: u.sectionsTouched ?? [],
      });
      // ponytail: newsletter trigger omitted — Brevo is 401-broken; wire /api/newsletter/send here once Resend replaces it
      return NextResponse.json({ inserted: true });
    }

    return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
