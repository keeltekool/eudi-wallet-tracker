import { db } from "@/src/db/client";
import { articles, sources, livingDoc } from "@/src/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendLatestUpdate } from "@/src/lib/newsletter";

/**
 * Loop API — token-guarded endpoints for the EUDI Pipeline cloud routine.
 * The routine follows loop/pipeline.md and never needs DATABASE_URL. Auth: Bearer LOOP_TOKEN (Vercel env).
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
        .orderBy(desc(articles.scrapedAt)) // ponytail: newest first so stale backlog can't starve fresh content
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
        .orderBy(desc(articles.scrapedAt))
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
      let since = url.searchParams.get("since");
      if (since === "last-update") {
        // Everything accepted since the previous update log was written (server clock, not the routine's runDate)
        const [last] = await db
          .select({ createdAt: livingDoc.createdAt })
          .from(livingDoc)
          .where(eq(livingDoc.section, "update"))
          .orderBy(desc(livingDoc.createdAt))
          .limit(1);
        since = last?.createdAt ? last.createdAt.toISOString() : null;
      }
      const conditions = [eq(articles.status, "accepted")];
      // Curation time, not scrape time: an article scraped before `since` but accepted after it still counts
      if (since) conditions.push(sql`coalesce(${articles.curatedAt}, ${articles.scrapedAt}) > ${new Date(since)}`);
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
              curatedAt: new Date(),
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
              curatedAt: new Date(),
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
      // A failed send must not fail the update write
      const newsletter = await sendLatestUpdate().catch((err) => ({ sent: 0, error: String(err) }));
      return NextResponse.json({ inserted: true, newsletter });
    }

    if (op === "newsletter-send") {
      // Re-sends the latest update log to active subscribers without writing a new update
      // row, for when living-doc-update wrote the log but the send failed.
      const newsletter = await sendLatestUpdate().catch((err) => ({ sent: 0, error: String(err) }));
      return NextResponse.json({ resent: true, newsletter });
    }

    if (op === "brief-patch") {
      // Replaces one "## " section of the Strategy Brief; the previous Brief is kept as row "bible-prev"
      const heading = String(body.heading ?? "").trim();
      const content = String(body.content ?? "").trim();
      const [bible] = await db.select().from(livingDoc).where(eq(livingDoc.section, "bible")).limit(1);
      if (!bible) return NextResponse.json({ error: "Bible not found" }, { status: 404 });

      const lines = bible.content.split("\n");
      const hits = lines.flatMap((l, i) => (l.trim() === heading ? [i] : []));
      if (!heading.startsWith("## ") || hits.length !== 1) {
        return NextResponse.json({ error: `heading must match one "## " line exactly; found ${hits.length}` }, { status: 400 });
      }
      // A heading line in the body would add a section (or duplicate this one) and break every later patch of it
      if (/^#{1,2} /m.test(content)) {
        return NextResponse.json({ error: "content must be the section body only: no # or ## heading lines" }, { status: 400 });
      }
      const start = hits[0] + 1;
      const next = lines.findIndex((l, i) => i >= start && l.startsWith("## "));
      const end = next === -1 ? lines.length : next;
      const rawBlock = lines.slice(start, end).join("\n");
      const oldBlock = rawBlock.trim();
      if (!content || content.length < oldBlock.length * 0.3) {
        return NextResponse.json(
          { error: `content is ${content.length} chars; the old block is ${oldBlock.length}, minimum is 30%` },
          { status: 400 }
        );
      }

      // bible-prev = the Brief before this run's first patch. ponytail: "this run" = patched in the last 2 hours
      const patchedThisRun = bible.runDate && Date.now() - bible.runDate.getTime() < 2 * 3600_000;
      if (!patchedThisRun) {
        const [prev] = await db.select({ id: livingDoc.id }).from(livingDoc).where(eq(livingDoc.section, "bible-prev")).limit(1);
        if (prev) await db.update(livingDoc).set({ content: bible.content, runDate: bible.runDate }).where(eq(livingDoc.id, prev.id));
        else await db.insert(livingDoc).values({ section: "bible-prev", content: bible.content, runDate: bible.runDate });
      }

      // Swap only the trimmed text so the blank lines around it stay as they were (function replacer: no $ patterns)
      const eol = bible.content.includes("\r\n") ? "\r\n" : "\n"; // the Brief is CRLF; keep it uniform
      const newBlock = rawBlock.replace(oldBlock, () => content.replace(/\r?\n/g, eol));
      const patched = [...lines.slice(0, start), newBlock, ...lines.slice(end)].join("\n");
      await db.update(livingDoc).set({ content: patched, runDate: new Date() }).where(eq(livingDoc.id, bible.id));
      return NextResponse.json({ patched: true, heading });
    }

    return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
