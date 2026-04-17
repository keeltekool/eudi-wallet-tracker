import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";
import { getDbForProject } from "@/src/lib/db/connections";
import { sources as allekirjoitusSources } from "@/src/db/schema-allekirjoitus";

const VALID_TYPES = ["rss", "css"];
const VALID_CATEGORIES = [
  "regulation",
  "technical-standards",
  "national-implementation",
  "industry",
  "security-privacy",
  "interoperability",
  "market-analysis",
];

const ALLEKIRJOITUS_THEMES = [
  "pricing",
  "features",
  "integrations",
  "eid",
  "compliance",
  "market",
  "eudi-wallet",
];

type ImportEntry = {
  name: string;
  url: string;
  type: string;
  category?: string;
  config?: Record<string, unknown>;
};

type AllekirjoitusEntry = {
  competitor: string;
  url: string;
  theme: string;
  purpose?: string | null;
};

type ValidationResult = {
  entry: ImportEntry;
  index: number;
  status: "new" | "duplicate" | "invalid";
  reason?: string;
  matchedSource?: string;
};

type AllekirjoitusValidationResult = {
  entry: AllekirjoitusEntry;
  index: number;
  status: "new" | "duplicate" | "invalid";
  reason?: string;
  matchedSource?: string;
};

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "").toLowerCase();
}

function validateEntry(entry: unknown, index: number): ValidationResult {
  const e = entry as ImportEntry;

  if (!e || typeof e !== "object") {
    return {
      entry: e,
      index,
      status: "invalid",
      reason: "Not a valid object",
    };
  }

  if (!e.name || typeof e.name !== "string" || !e.name.trim()) {
    return { entry: e, index, status: "invalid", reason: "Missing name" };
  }

  if (!e.url || typeof e.url !== "string") {
    return { entry: e, index, status: "invalid", reason: "Missing URL" };
  }

  try {
    new URL(e.url);
  } catch {
    return { entry: e, index, status: "invalid", reason: "Invalid URL" };
  }

  if (!e.type || !VALID_TYPES.includes(e.type)) {
    return {
      entry: e,
      index,
      status: "invalid",
      reason: `Invalid type "${e.type}" — must be "rss" or "css"`,
    };
  }

  if (e.category && !VALID_CATEGORIES.includes(e.category)) {
    return {
      entry: e,
      index,
      status: "invalid",
      reason: `Invalid category "${e.category}"`,
    };
  }

  return { entry: e, index, status: "new" };
}

function validateAllekirjoitusEntry(
  entry: unknown,
  index: number,
): AllekirjoitusValidationResult {
  const e = entry as AllekirjoitusEntry;

  if (!e || typeof e !== "object") {
    return {
      entry: e,
      index,
      status: "invalid",
      reason: "Not a valid object",
    };
  }

  if (!e.competitor || typeof e.competitor !== "string" || !e.competitor.trim()) {
    return {
      entry: e,
      index,
      status: "invalid",
      reason: "Missing competitor",
    };
  }

  if (!e.url || typeof e.url !== "string") {
    return { entry: e, index, status: "invalid", reason: "Missing URL" };
  }

  let parsed: URL;
  try {
    parsed = new URL(e.url);
  } catch {
    return { entry: e, index, status: "invalid", reason: "Invalid URL" };
  }
  if (parsed.protocol !== "https:") {
    return {
      entry: e,
      index,
      status: "invalid",
      reason: "URL must use https",
    };
  }

  if (!e.theme || typeof e.theme !== "string") {
    return { entry: e, index, status: "invalid", reason: "Missing theme" };
  }
  if (!ALLEKIRJOITUS_THEMES.includes(e.theme)) {
    return {
      entry: e,
      index,
      status: "invalid",
      reason: `Invalid theme "${e.theme}"`,
    };
  }

  return { entry: e, index, status: "new" };
}

// POST with action=preview: validate + check duplicates, return results
// POST with action=import: insert non-duplicate valid entries
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { entries, action, project = "eudi" } = body as {
    entries: unknown[];
    action: "preview" | "import";
    project?: "eudi" | "allekirjoitus";
  };

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json(
      { error: "Entries must be a non-empty array" },
      { status: 400 },
    );
  }

  if (entries.length > 100) {
    return NextResponse.json(
      { error: "Maximum 100 sources per import" },
      { status: 400 },
    );
  }

  if (project === "eudi") {
    // 1. Validate each entry
    const results: ValidationResult[] = entries.map((e, i) =>
      validateEntry(e, i),
    );

    // 2. Check duplicates against existing sources
    const existingSources = await db
      .select({ url: sources.url, name: sources.name })
      .from(sources);

    const existingUrls = new Map(
      existingSources.map((s) => [normalizeUrl(s.url), s.name]),
    );

    // Also check for duplicates within the import batch itself
    const seenInBatch = new Map<string, number>();

    for (const result of results) {
      if (result.status === "invalid") continue;

      const normalized = normalizeUrl(result.entry.url);

      // Check against existing DB sources
      const existingName = existingUrls.get(normalized);
      if (existingName) {
        result.status = "duplicate";
        result.matchedSource = existingName;
        continue;
      }

      // Check against earlier entries in same batch
      const earlierIndex = seenInBatch.get(normalized);
      if (earlierIndex !== undefined) {
        result.status = "duplicate";
        result.reason = `Duplicate of entry #${earlierIndex + 1} in this batch`;
        continue;
      }

      seenInBatch.set(normalized, result.index);
    }

    const summary = {
      total: results.length,
      new: results.filter((r) => r.status === "new").length,
      duplicate: results.filter((r) => r.status === "duplicate").length,
      invalid: results.filter((r) => r.status === "invalid").length,
    };

    if (action === "preview") {
      return NextResponse.json({ results, summary });
    }

    // action === "import" — insert only "new" entries
    const toInsert = results.filter((r) => r.status === "new");
    let inserted = 0;

    for (const result of toInsert) {
      const e = result.entry;
      await db.insert(sources).values({
        name: e.name.trim(),
        url: e.url.trim(),
        type: e.type as "rss" | "css",
        category: e.category || null,
        config: e.config || {},
        active: true,
      });
      inserted++;
    }

    return NextResponse.json({
      results,
      summary: { ...summary, inserted },
    });
  }

  if (project === "allekirjoitus") {
    const allekirjoitusDb = getDbForProject("allekirjoitus");

    const results: AllekirjoitusValidationResult[] = entries.map((e, i) =>
      validateAllekirjoitusEntry(e, i),
    );

    const existingRows = await allekirjoitusDb
      .select({
        url: allekirjoitusSources.url,
        competitor: allekirjoitusSources.competitor,
      })
      .from(allekirjoitusSources);

    const existingUrls = new Map(
      existingRows.map((s) => [normalizeUrl(s.url), s.competitor]),
    );

    const seenInBatch = new Map<string, number>();

    for (const result of results) {
      if (result.status === "invalid") continue;
      const normalized = normalizeUrl(result.entry.url);

      const existingCompetitor = existingUrls.get(normalized);
      if (existingCompetitor) {
        result.status = "duplicate";
        result.matchedSource = existingCompetitor;
        continue;
      }

      const earlierIndex = seenInBatch.get(normalized);
      if (earlierIndex !== undefined) {
        result.status = "duplicate";
        result.reason = `Duplicate of entry #${earlierIndex + 1} in this batch`;
        continue;
      }

      seenInBatch.set(normalized, result.index);
    }

    const summary = {
      total: results.length,
      new: results.filter((r) => r.status === "new").length,
      duplicate: results.filter((r) => r.status === "duplicate").length,
      invalid: results.filter((r) => r.status === "invalid").length,
    };

    if (action === "preview") {
      return NextResponse.json({ results, summary });
    }

    const toInsert = results.filter((r) => r.status === "new");
    let inserted = 0;

    for (const result of toInsert) {
      const e = result.entry;
      await allekirjoitusDb.insert(allekirjoitusSources).values({
        competitor: e.competitor.trim(),
        url: e.url.trim(),
        theme: e.theme,
        purpose:
          typeof e.purpose === "string" && e.purpose.trim()
            ? e.purpose.trim()
            : null,
        active: true,
      });
      inserted++;
    }

    return NextResponse.json({
      results,
      summary: { ...summary, inserted },
    });
  }

  return NextResponse.json({ error: "Unknown project" }, { status: 400 });
}
