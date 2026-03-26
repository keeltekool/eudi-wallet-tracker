import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";

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

type ImportEntry = {
  name: string;
  url: string;
  type: string;
  category?: string;
  config?: Record<string, unknown>;
};

type ValidationResult = {
  entry: ImportEntry;
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

// POST with action=preview: validate + check duplicates, return results
// POST with action=import: insert non-duplicate valid entries
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { entries, action } = body as {
    entries: unknown[];
    action: "preview" | "import";
  };

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json(
      { error: "Entries must be a non-empty array" },
      { status: 400 }
    );
  }

  if (entries.length > 100) {
    return NextResponse.json(
      { error: "Maximum 100 sources per import" },
      { status: 400 }
    );
  }

  // 1. Validate each entry
  const results: ValidationResult[] = entries.map((e, i) =>
    validateEntry(e, i)
  );

  // 2. Check duplicates against existing sources
  const existingSources = await db
    .select({ url: sources.url, name: sources.name })
    .from(sources);

  const existingUrls = new Map(
    existingSources.map((s) => [normalizeUrl(s.url), s.name])
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
