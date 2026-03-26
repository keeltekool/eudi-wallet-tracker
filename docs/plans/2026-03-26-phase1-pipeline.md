# Phase 1: Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the autonomous scraping pipeline — Render worker scrapes 36 sources twice/week, validates, deduplicates, and stores articles as `pending` in Neon Postgres.

**Architecture:** Monorepo with two deployable units: `worker/` (Render, Node.js) and the Next.js app (Vercel, Phase 2+). Shared Drizzle schema in `src/db/`. The worker runs `node-cron` twice-weekly, iterates all active sources, fetches articles via RSS or CSS parsing, deduplicates by URL hash + content fingerprint, and inserts new articles as `pending`. Each scrape run is logged in `scrape_runs`.

**Tech Stack:** Node.js 20 + TypeScript, Drizzle ORM + Neon Postgres, rss-parser (RSS/Atom), cheerio (CSS scraping), node-cron (scheduling), dotenv.

---

## Phase Structure

| Phase | Tasks | What's Verified |
|-------|-------|-----------------|
| **Foundation** | Tasks 1–4 | Project scaffold, DB schema, Neon connected, migrations applied |
| **Core Scraper** | Tasks 5–8 | RSS parser + CSS parser + validation + dedup all working with tests |
| **Worker Runtime** | Tasks 9–11 | Orchestrator, cron scheduler, Render deployment config |
| **Seed & Verify** | Tasks 12–13 | 36 sources seeded, first live scrape verified |
| **CHECKPOINT** | — | Full E2E: worker runs on Render, scrapes real sources, articles in Neon |

---

## Task 1: Project Scaffold + Git Init

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.json` (root)
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `.gitignore`
- Create: `.env.local` (local dev, never committed)

**Step 1: Initialize project root**

```bash
cd C:\Users\Kasutaja\Claude_Projects\eudi-wallet-tracker
npm init -y
```

**Step 2: Create root `package.json` with workspaces**

```json
{
  "name": "eudi-wallet-tracker",
  "private": true,
  "workspaces": ["worker"]
}
```

**Step 3: Create root `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create `worker/package.json`**

```json
{
  "name": "eudi-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/worker/src/index.js",
    "scrape": "tsx src/run-scrape.ts"
  },
  "dependencies": {
    "cheerio": "1.0.0",
    "dotenv": "16.5.0",
    "node-cron": "3.0.3",
    "rss-parser": "3.13.0"
  },
  "devDependencies": {
    "tsx": "4.19.4",
    "@types/node": "22.15.3",
    "@types/node-cron": "3.0.11",
    "typescript": "5.8.3"
  }
}
```

**Step 5: Create `worker/tsconfig.json`**

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "../dist/worker",
    "rootDir": ".."
  },
  "include": ["src/**/*", "../src/db/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 6: Create `.gitignore`**

```
node_modules/
dist/
.env
.env.local
.env*.local
*.tsbuildinfo
.vercel
.next
```

**Step 7: Create `.env.local`**

```
DATABASE_URL=<will be filled after Neon DB creation>
```

**Step 8: Git init + GitHub repo + first commit**

```bash
git init
git add -A
git commit -m "chore: project scaffold with worker workspace"
gh repo create keeltekool/eudi-wallet-tracker --private --source=. --push
```

---

## Task 2: Neon Database + Drizzle Setup

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`
- Create: `drizzle.config.ts`
- Modify: root `package.json` (add drizzle scripts + deps)

**Step 1: Install Drizzle dependencies at root**

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

**Step 2: Create Neon database**

Go to Neon console, create project `eudi-wallet-tracker`. Copy the `DATABASE_URL` and add it to `.env.local`.

**Step 3: Create `drizzle.config.ts`**

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 4: Create `src/db/schema.ts`**

```typescript
import {
  pgTable,
  pgEnum,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  real,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────

export const sourceTypeEnum = pgEnum("source_type", ["rss", "css"]);

export const articleStatusEnum = pgEnum("article_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const scrapeRunStatusEnum = pgEnum("scrape_run_status", [
  "running",
  "success",
  "failed",
]);

// ── Sources ────────────────────────────────────────

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: sourceTypeEnum("type").notNull(),
  category: text("category"),
  config: jsonb("config").$type<SourceConfig>().default({}),
  active: boolean("active").notNull().default(true),
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  lastArticleCount: integer("last_article_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ── Articles ───────────────────────────────────────

export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    url: text("url").notNull(),
    urlHash: varchar("url_hash", { length: 64 }).notNull(),
    contentHash: varchar("content_hash", { length: 64 }),
    title: text("title").notNull(),
    author: text("author"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    fullText: text("full_text"),
    summary: text("summary"),
    relevanceScore: real("relevance_score"),
    categories: text("categories")
      .array()
      .default([]),
    status: articleStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
  },
  (table) => [uniqueIndex("articles_url_hash_idx").on(table.urlHash)]
);

// ── Scrape Runs ────────────────────────────────────

export const scrapeRuns = pgTable("scrape_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: scrapeRunStatusEnum("status").notNull().default("running"),
  sourcesScraped: integer("sources_scraped").default(0),
  articlesFound: integer("articles_found").default(0),
  errors: jsonb("errors").$type<ScrapeError[]>().default([]),
});

// ── Types ──────────────────────────────────────────

export type SourceConfig = {
  // RSS-specific
  feedUrl?: string;

  // CSS-specific
  articleSelector?: string;
  titleSelector?: string;
  linkSelector?: string;
  dateSelector?: string;
  authorSelector?: string;
  excerptSelector?: string;
  baseUrl?: string;
};

export type ScrapeError = {
  sourceId: number;
  sourceName: string;
  error: string;
};
```

**Step 5: Create `src/db/index.ts`**

```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, schema });
}

export type Database = ReturnType<typeof createDb>;
```

**Step 6: Add drizzle scripts to root `package.json`**

Add to `scripts`:
```json
{
  "db:generate": "drizzle-kit generate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
}
```

**Step 7: Push schema to Neon**

```bash
npm run db:push
```

**Step 8: Verify tables exist**

```bash
npx drizzle-kit studio
```

Open in browser — confirm `sources`, `articles`, `scrape_runs` tables exist with correct columns.

**Step 9: Commit**

```bash
git add src/db/ drizzle.config.ts drizzle/ package.json package-lock.json
git commit -m "feat: Drizzle schema — sources, articles, scrape_runs tables"
```

---

## Task 3: URL Hashing Utility

**Files:**
- Create: `src/lib/hash.ts`
- Create: `src/lib/__tests__/hash.test.ts`
- Modify: root `package.json` (add vitest)

**Step 1: Install vitest**

```bash
npm install -D vitest
```

Add to root `package.json` scripts:
```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

**Step 2: Write the failing test**

Create `src/lib/__tests__/hash.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { hashUrl, hashContent } from "../hash";

describe("hashUrl", () => {
  it("returns consistent SHA-256 hex for a URL", () => {
    const hash = hashUrl("https://example.com/article/123");
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashUrl("https://example.com/article/123"));
  });

  it("normalizes trailing slashes", () => {
    expect(hashUrl("https://example.com/path/")).toBe(
      hashUrl("https://example.com/path")
    );
  });

  it("different URLs produce different hashes", () => {
    expect(hashUrl("https://a.com")).not.toBe(hashUrl("https://b.com"));
  });
});

describe("hashContent", () => {
  it("hashes title + first 200 chars of content", () => {
    const hash = hashContent("My Title", "Some content here");
    expect(hash).toHaveLength(64);
  });

  it("same title + content = same hash", () => {
    const a = hashContent("Title", "Body text");
    const b = hashContent("Title", "Body text");
    expect(a).toBe(b);
  });

  it("truncates content to first 200 chars before hashing", () => {
    const longText = "x".repeat(500);
    const a = hashContent("T", longText);
    const b = hashContent("T", longText.slice(0, 200));
    expect(a).toBe(b);
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npm test -- src/lib/__tests__/hash.test.ts
```

Expected: FAIL — module not found.

**Step 4: Write implementation**

Create `src/lib/hash.ts`:

```typescript
import { createHash } from "crypto";

export function hashUrl(url: string): string {
  const normalized = url.replace(/\/+$/, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export function hashContent(title: string, content?: string): string {
  const truncated = (content || "").slice(0, 200);
  const input = `${title}::${truncated}`;
  return createHash("sha256").update(input).digest("hex");
}
```

**Step 5: Run test to verify it passes**

```bash
npm test -- src/lib/__tests__/hash.test.ts
```

Expected: ALL PASS.

**Step 6: Commit**

```bash
git add src/lib/hash.ts src/lib/__tests__/hash.test.ts package.json package-lock.json
git commit -m "feat: URL and content hashing utilities with tests"
```

---

## Task 4: Article Validation Utility

**Files:**
- Create: `src/lib/validate.ts`
- Create: `src/lib/__tests__/validate.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/validate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateArticle, type RawArticle } from "../validate";

const valid: RawArticle = {
  title: "EUDI Wallet Update",
  url: "https://example.com/article",
  publishedAt: new Date("2026-03-01"),
};

describe("validateArticle", () => {
  it("accepts a valid article", () => {
    const result = validateArticle(valid);
    expect(result.valid).toBe(true);
  });

  it("rejects empty title", () => {
    const result = validateArticle({ ...valid, title: "" });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("title");
  });

  it("rejects whitespace-only title", () => {
    const result = validateArticle({ ...valid, title: "   " });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = validateArticle({ ...valid, url: "not-a-url" });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("URL");
  });

  it("rejects future-dated articles (>2 days ahead)", () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const result = validateArticle({ ...valid, publishedAt: future });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("future");
  });

  it("accepts articles with no date", () => {
    const result = validateArticle({ ...valid, publishedAt: undefined });
    expect(result.valid).toBe(true);
  });

  it("accepts articles dated today", () => {
    const result = validateArticle({ ...valid, publishedAt: new Date() });
    expect(result.valid).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/__tests__/validate.test.ts
```

**Step 3: Write implementation**

Create `src/lib/validate.ts`:

```typescript
export type RawArticle = {
  title: string;
  url: string;
  publishedAt?: Date;
  author?: string;
  fullText?: string;
};

type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validateArticle(article: RawArticle): ValidationResult {
  if (!article.title || !article.title.trim()) {
    return { valid: false, reason: "Empty or missing title" };
  }

  try {
    new URL(article.url);
  } catch {
    return { valid: false, reason: "Invalid URL" };
  }

  if (article.publishedAt) {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    if (article.publishedAt > twoDaysFromNow) {
      return { valid: false, reason: "Article is future-dated" };
    }
  }

  return { valid: true };
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/__tests__/validate.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/validate.ts src/lib/__tests__/validate.test.ts
git commit -m "feat: article validation utility with tests"
```

---

## ── CHECKPOINT: Foundation ──

**Verify:**
- [ ] `npm test` — all tests pass (hash + validate)
- [ ] `npm run db:push` — schema applied to Neon
- [ ] Drizzle Studio shows 3 empty tables with correct columns
- [ ] GitHub repo exists with 4 commits

---

## Task 5: RSS Parser

**Files:**
- Create: `worker/src/parsers/rss.ts`
- Create: `worker/src/parsers/__tests__/rss.test.ts`
- Create: `worker/src/parsers/types.ts`

**Step 1: Install worker dependencies**

```bash
cd worker && npm install && cd ..
```

**Step 2: Create parser types**

Create `worker/src/parsers/types.ts`:

```typescript
import type { RawArticle } from "../../src/lib/validate";

export type ParseResult = {
  articles: RawArticle[];
  errors: string[];
};

export type ParserConfig = {
  feedUrl?: string;
  articleSelector?: string;
  titleSelector?: string;
  linkSelector?: string;
  dateSelector?: string;
  authorSelector?: string;
  excerptSelector?: string;
  baseUrl?: string;
};
```

Note: The worker imports from the shared `src/lib/` — this works because `worker/tsconfig.json` includes `../src/db/**/*` and the worker's build resolves paths relative to the monorepo root.

**Step 3: Write the failing test**

Create `worker/src/parsers/__tests__/rss.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { parseRss } from "../rss";

// Mock rss-parser
vi.mock("rss-parser", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      parseURL: vi.fn().mockResolvedValue({
        items: [
          {
            title: "EUDI Wallet ARF v1.5 Released",
            link: "https://example.com/article-1",
            pubDate: "Mon, 24 Mar 2026 10:00:00 GMT",
            creator: "EC Digital",
            contentSnippet: "The Architecture Reference Framework...",
          },
          {
            title: "Second Article",
            link: "https://example.com/article-2",
            pubDate: "Tue, 25 Mar 2026 10:00:00 GMT",
          },
        ],
      }),
    })),
  };
});

describe("parseRss", () => {
  it("parses RSS feed items into RawArticles", async () => {
    const result = await parseRss("https://example.com/feed");
    expect(result.articles).toHaveLength(2);
    expect(result.articles[0].title).toBe("EUDI Wallet ARF v1.5 Released");
    expect(result.articles[0].url).toBe("https://example.com/article-1");
    expect(result.articles[0].author).toBe("EC Digital");
    expect(result.errors).toHaveLength(0);
  });

  it("skips items without title or link", async () => {
    const RssParser = (await import("rss-parser")).default;
    vi.mocked(RssParser).mockImplementation(
      () =>
        ({
          parseURL: vi.fn().mockResolvedValue({
            items: [
              { title: "Good", link: "https://example.com/ok" },
              { title: "", link: "https://example.com/no-title" },
              { title: "No Link" },
            ],
          }),
        }) as any
    );

    const result = await parseRss("https://example.com/feed");
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].title).toBe("Good");
  });

  it("returns error on fetch failure", async () => {
    const RssParser = (await import("rss-parser")).default;
    vi.mocked(RssParser).mockImplementation(
      () =>
        ({
          parseURL: vi.fn().mockRejectedValue(new Error("Network error")),
        }) as any
    );

    const result = await parseRss("https://example.com/feed");
    expect(result.articles).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Network error");
  });
});
```

**Step 4: Run test to verify it fails**

```bash
npm test -- worker/src/parsers/__tests__/rss.test.ts
```

**Step 5: Write implementation**

Create `worker/src/parsers/rss.ts`:

```typescript
import RssParser from "rss-parser";
import type { ParseResult } from "./types";

const parser = new RssParser({
  timeout: 15000,
  headers: {
    "User-Agent": "EUDI-Wallet-Tracker/1.0 (news aggregator)",
  },
});

export async function parseRss(feedUrl: string): Promise<ParseResult> {
  try {
    const feed = await parser.parseURL(feedUrl);
    const articles = feed.items
      .filter((item) => item.title?.trim() && item.link)
      .map((item) => ({
        title: item.title!.trim(),
        url: item.link!,
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
        author: item.creator || item["dc:creator"] || undefined,
        fullText: item.contentSnippet || item.content || undefined,
      }));

    return { articles, errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { articles: [], errors: [message] };
  }
}
```

**Step 6: Run test to verify it passes**

```bash
npm test -- worker/src/parsers/__tests__/rss.test.ts
```

**Step 7: Commit**

```bash
git add worker/src/parsers/
git commit -m "feat: RSS parser with tests"
```

---

## Task 6: CSS Scraper

**Files:**
- Create: `worker/src/parsers/css.ts`
- Create: `worker/src/parsers/__tests__/css.test.ts`

**Step 1: Write the failing test**

Create `worker/src/parsers/__tests__/css.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { parseCss } from "../css";
import type { ParserConfig } from "../types";

// Mock global fetch
const mockHtml = `
<html>
<body>
  <div class="news-list">
    <article class="news-item">
      <h2 class="title"><a href="/news/eudi-update">EUDI Wallet Update</a></h2>
      <span class="date">2026-03-20</span>
      <span class="author">John</span>
      <p class="excerpt">Important update about EUDI...</p>
    </article>
    <article class="news-item">
      <h2 class="title"><a href="https://external.com/article">External Article</a></h2>
      <span class="date">2026-03-21</span>
      <p class="excerpt">Another update...</p>
    </article>
  </div>
</body>
</html>
`;

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(mockHtml),
  })
);

const config: ParserConfig = {
  articleSelector: "article.news-item",
  titleSelector: "h2.title a",
  linkSelector: "h2.title a",
  dateSelector: "span.date",
  authorSelector: "span.author",
  excerptSelector: "p.excerpt",
  baseUrl: "https://example.com",
};

describe("parseCss", () => {
  it("extracts articles using CSS selectors", async () => {
    const result = await parseCss("https://example.com/news", config);
    expect(result.articles).toHaveLength(2);
    expect(result.articles[0].title).toBe("EUDI Wallet Update");
    expect(result.articles[0].url).toBe("https://example.com/news/eudi-update");
    expect(result.articles[0].author).toBe("John");
    expect(result.errors).toHaveLength(0);
  });

  it("resolves relative URLs against baseUrl", async () => {
    const result = await parseCss("https://example.com/news", config);
    expect(result.articles[0].url).toBe("https://example.com/news/eudi-update");
    expect(result.articles[1].url).toBe("https://external.com/article");
  });

  it("returns error on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Timeout"));
    const result = await parseCss("https://example.com/news", config);
    expect(result.articles).toHaveLength(0);
    expect(result.errors[0]).toContain("Timeout");
  });

  it("returns error when articleSelector matches nothing", async () => {
    const badConfig = { ...config, articleSelector: ".nonexistent" };
    const result = await parseCss("https://example.com/news", badConfig);
    expect(result.articles).toHaveLength(0);
    // No error — just zero articles (not a crash)
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- worker/src/parsers/__tests__/css.test.ts
```

**Step 3: Write implementation**

Create `worker/src/parsers/css.ts`:

```typescript
import * as cheerio from "cheerio";
import type { ParseResult, ParserConfig } from "./types";

export async function parseCss(
  pageUrl: string,
  config: ParserConfig
): Promise<ParseResult> {
  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "EUDI-Wallet-Tracker/1.0 (news aggregator)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return {
        articles: [],
        errors: [`HTTP ${response.status} from ${pageUrl}`],
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    if (!config.articleSelector) {
      return { articles: [], errors: ["No articleSelector configured"] };
    }

    const articles: ParseResult["articles"] = [];

    $(config.articleSelector).each((_, el) => {
      const $el = $(el);

      const titleEl = config.titleSelector ? $el.find(config.titleSelector) : $el;
      const title = titleEl.text().trim();

      const linkEl = config.linkSelector ? $el.find(config.linkSelector) : titleEl;
      const rawHref = linkEl.attr("href") || "";

      if (!title || !rawHref) return;

      const url = resolveUrl(rawHref, config.baseUrl || pageUrl);

      const dateText = config.dateSelector
        ? $el.find(config.dateSelector).text().trim()
        : undefined;
      const publishedAt = dateText ? parseDate(dateText) : undefined;

      const author = config.authorSelector
        ? $el.find(config.authorSelector).text().trim() || undefined
        : undefined;

      const fullText = config.excerptSelector
        ? $el.find(config.excerptSelector).text().trim() || undefined
        : undefined;

      articles.push({ title, url, publishedAt, author, fullText });
    });

    return { articles, errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { articles: [], errors: [message] };
  }
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function parseDate(dateStr: string): Date | undefined {
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- worker/src/parsers/__tests__/css.test.ts
```

**Step 5: Commit**

```bash
git add worker/src/parsers/css.ts worker/src/parsers/__tests__/css.test.ts
git commit -m "feat: CSS scraper with Cheerio + tests"
```

---

## Task 7: Parser Router (dispatch by source type)

**Files:**
- Create: `worker/src/parsers/index.ts`
- Create: `worker/src/parsers/__tests__/index.test.ts`

**Step 1: Write the failing test**

Create `worker/src/parsers/__tests__/index.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { parseSource } from "../index";

vi.mock("../rss", () => ({
  parseRss: vi.fn().mockResolvedValue({
    articles: [{ title: "RSS Article", url: "https://rss.com/1" }],
    errors: [],
  }),
}));

vi.mock("../css", () => ({
  parseCss: vi.fn().mockResolvedValue({
    articles: [{ title: "CSS Article", url: "https://css.com/1" }],
    errors: [],
  }),
}));

describe("parseSource", () => {
  it("routes RSS sources to parseRss", async () => {
    const result = await parseSource({
      type: "rss",
      url: "https://example.com",
      config: { feedUrl: "https://example.com/feed" },
    });
    expect(result.articles[0].title).toBe("RSS Article");
  });

  it("uses feedUrl from config for RSS, falls back to source url", async () => {
    const { parseRss } = await import("../rss");
    await parseSource({
      type: "rss",
      url: "https://example.com",
      config: { feedUrl: "https://example.com/feed.xml" },
    });
    expect(parseRss).toHaveBeenCalledWith("https://example.com/feed.xml");
  });

  it("routes CSS sources to parseCss", async () => {
    const result = await parseSource({
      type: "css",
      url: "https://example.com/news",
      config: { articleSelector: ".item" },
    });
    expect(result.articles[0].title).toBe("CSS Article");
  });

  it("returns error for unknown source type", async () => {
    const result = await parseSource({
      type: "unknown" as any,
      url: "https://example.com",
      config: {},
    });
    expect(result.articles).toHaveLength(0);
    expect(result.errors[0]).toContain("Unknown parser type");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- worker/src/parsers/__tests__/index.test.ts
```

**Step 3: Write implementation**

Create `worker/src/parsers/index.ts`:

```typescript
import { parseRss } from "./rss";
import { parseCss } from "./css";
import type { ParseResult, ParserConfig } from "./types";

type SourceInput = {
  type: "rss" | "css";
  url: string;
  config: ParserConfig;
};

export async function parseSource(source: SourceInput): Promise<ParseResult> {
  switch (source.type) {
    case "rss":
      return parseRss(source.config.feedUrl || source.url);
    case "css":
      return parseCss(source.url, source.config);
    default:
      return {
        articles: [],
        errors: [`Unknown parser type: ${(source as any).type}`],
      };
  }
}

export type { ParseResult, ParserConfig } from "./types";
```

**Step 4: Run test to verify it passes**

```bash
npm test -- worker/src/parsers/__tests__/index.test.ts
```

**Step 5: Commit**

```bash
git add worker/src/parsers/index.ts worker/src/parsers/__tests__/index.test.ts
git commit -m "feat: parser router dispatches by source type"
```

---

## Task 8: Deduplication + Insert Logic

**Files:**
- Create: `worker/src/store.ts`
- Create: `worker/src/__tests__/store.test.ts`

**Step 1: Write the failing test**

Create `worker/src/__tests__/store.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { deduplicateAndStore } from "../store";

// Mock the DB
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onConflictDoNothing: vi.fn().mockResolvedValue([{ rowCount: 1 }]),
};

describe("deduplicateAndStore", () => {
  it("stores new articles with pending status", async () => {
    const articles = [
      { title: "New Article", url: "https://example.com/new" },
    ];

    const result = await deduplicateAndStore(mockDb as any, 1, articles);
    expect(result.inserted).toBe(1);
    expect(result.duplicates).toBe(0);
  });

  it("skips duplicate articles (same URL hash)", async () => {
    // Simulate existing article
    mockDb.where.mockResolvedValueOnce([{ urlHash: "existing-hash" }]);

    const articles = [
      { title: "Existing Article", url: "https://example.com/existing" },
    ];

    const result = await deduplicateAndStore(mockDb as any, 1, articles);
    expect(result.duplicates).toBe(1);
  });

  it("handles empty article list", async () => {
    const result = await deduplicateAndStore(mockDb as any, 1, []);
    expect(result.inserted).toBe(0);
    expect(result.duplicates).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- worker/src/__tests__/store.test.ts
```

**Step 3: Write implementation**

Create `worker/src/store.ts`:

```typescript
import { eq } from "drizzle-orm";
import { articles } from "../src/db/schema";
import { hashUrl, hashContent } from "../src/lib/hash";
import { validateArticle, type RawArticle } from "../src/lib/validate";
import type { Database } from "../src/db/index";

type StoreResult = {
  inserted: number;
  duplicates: number;
  invalid: number;
};

export async function deduplicateAndStore(
  db: Database,
  sourceId: number,
  rawArticles: RawArticle[]
): Promise<StoreResult> {
  let inserted = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const raw of rawArticles) {
    const validation = validateArticle(raw);
    if (!validation.valid) {
      invalid++;
      continue;
    }

    const urlHash = hashUrl(raw.url);
    const contentHash = hashContent(raw.title, raw.fullText);

    try {
      const result = await db
        .insert(articles)
        .values({
          sourceId,
          url: raw.url,
          urlHash,
          contentHash,
          title: raw.title,
          author: raw.author,
          publishedAt: raw.publishedAt,
          fullText: raw.fullText,
          status: "pending",
        })
        .onConflictDoNothing({ target: articles.urlHash });

      // onConflictDoNothing returns empty array if conflict
      if (result.rowCount && result.rowCount > 0) {
        inserted++;
      } else {
        duplicates++;
      }
    } catch (error) {
      // Unique constraint violation = duplicate
      duplicates++;
    }
  }

  return { inserted, duplicates, invalid };
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- worker/src/__tests__/store.test.ts
```

**Step 5: Commit**

```bash
git add worker/src/store.ts worker/src/__tests__/store.test.ts
git commit -m "feat: deduplication + article storage with validation"
```

---

## ── CHECKPOINT: Core Scraper ──

**Verify:**
- [ ] `npm test` — all tests pass (hash, validate, rss, css, router, store)
- [ ] Each parser tested with mocks — RSS, CSS, and unknown type
- [ ] Dedup logic tested: new articles inserted, duplicates skipped

---

## Task 9: Scrape Orchestrator

The orchestrator ties everything together: loads active sources, runs each through the parser, stores results, logs the scrape run.

**Files:**
- Create: `worker/src/orchestrator.ts`

**Step 1: Write implementation**

Create `worker/src/orchestrator.ts`:

```typescript
import { eq } from "drizzle-orm";
import { sources, scrapeRuns } from "../src/db/schema";
import type { ScrapeError } from "../src/db/schema";
import type { Database } from "../src/db/index";
import { parseSource } from "./parsers/index";
import { deduplicateAndStore } from "./store";

export async function runScrape(db: Database): Promise<void> {
  console.log(`[scrape] Starting scrape run at ${new Date().toISOString()}`);

  // 1. Create scrape run record
  const [run] = await db
    .insert(scrapeRuns)
    .values({ status: "running" })
    .returning({ id: scrapeRuns.id });

  let totalArticles = 0;
  let sourcesScraped = 0;
  const errors: ScrapeError[] = [];

  try {
    // 2. Load active sources
    const activeSources = await db
      .select()
      .from(sources)
      .where(eq(sources.active, true));

    console.log(`[scrape] Found ${activeSources.length} active sources`);

    // 3. Process each source sequentially (be polite to servers)
    for (const source of activeSources) {
      console.log(`[scrape] Processing: ${source.name} (${source.type})`);

      try {
        const result = await parseSource({
          type: source.type,
          url: source.url,
          config: (source.config as any) || {},
        });

        if (result.errors.length > 0) {
          console.warn(
            `[scrape] ${source.name}: ${result.errors.join(", ")}`
          );
          errors.push({
            sourceId: source.id,
            sourceName: source.name,
            error: result.errors.join("; "),
          });
        }

        if (result.articles.length > 0) {
          const storeResult = await deduplicateAndStore(
            db,
            source.id,
            result.articles
          );
          console.log(
            `[scrape] ${source.name}: ${storeResult.inserted} new, ${storeResult.duplicates} dupes, ${storeResult.invalid} invalid`
          );
          totalArticles += storeResult.inserted;
        } else if (result.errors.length === 0) {
          console.log(`[scrape] ${source.name}: 0 articles found`);
        }

        // Update source's last scraped timestamp
        await db
          .update(sources)
          .set({
            lastScrapedAt: new Date(),
            lastArticleCount: result.articles.length,
          })
          .where(eq(sources.id, source.id));

        sourcesScraped++;

        // Polite delay between sources (1 second)
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[scrape] ${source.name} FAILED: ${message}`);
        errors.push({
          sourceId: source.id,
          sourceName: source.name,
          error: message,
        });
      }
    }

    // 4. Mark run as complete
    await db
      .update(scrapeRuns)
      .set({
        completedAt: new Date(),
        status: errors.length > 0 && sourcesScraped === 0 ? "failed" : "success",
        sourcesScraped,
        articlesFound: totalArticles,
        errors,
      })
      .where(eq(scrapeRuns.id, run.id));

    console.log(
      `[scrape] Complete: ${sourcesScraped} sources, ${totalArticles} new articles, ${errors.length} errors`
    );
  } catch (err) {
    // Fatal error — mark run as failed
    await db
      .update(scrapeRuns)
      .set({
        completedAt: new Date(),
        status: "failed",
        sourcesScraped,
        articlesFound: totalArticles,
        errors: [
          ...errors,
          {
            sourceId: 0,
            sourceName: "orchestrator",
            error: err instanceof Error ? err.message : String(err),
          },
        ],
      })
      .where(eq(scrapeRuns.id, run.id));

    console.error(`[scrape] Fatal error: ${err}`);
    throw err;
  }
}
```

**Step 2: Commit**

```bash
git add worker/src/orchestrator.ts
git commit -m "feat: scrape orchestrator — loads sources, parses, stores, logs"
```

---

## Task 10: Worker Entry Point + Cron + Manual Trigger

**Files:**
- Create: `worker/src/index.ts` (cron entry)
- Create: `worker/src/run-scrape.ts` (manual trigger)

**Step 1: Create `worker/src/index.ts`**

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });

import cron from "node-cron";
import { createDb } from "../src/db/index";
import { runScrape } from "./orchestrator";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(DATABASE_URL);

// Twice-weekly: Wednesday 06:00 UTC and Saturday 06:00 UTC
cron.schedule("0 6 * * 3,6", async () => {
  console.log("[cron] Triggered twice-weekly scrape");
  try {
    await runScrape(db);
  } catch (err) {
    console.error("[cron] Scrape failed:", err);
  }
});

console.log("[worker] EUDI Wallet Tracker worker started");
console.log("[worker] Scrape schedule: Wed + Sat at 06:00 UTC");

// Keep the process alive
// On Render, this runs as a background worker
```

**Step 2: Create `worker/src/run-scrape.ts` (manual trigger)**

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb } from "../src/db/index";
import { runScrape } from "./orchestrator";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function main() {
  const db = createDb(DATABASE_URL!);
  await runScrape(db);
  console.log("Manual scrape complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

**Step 3: Commit**

```bash
git add worker/src/index.ts worker/src/run-scrape.ts
git commit -m "feat: worker entry point with cron + manual scrape trigger"
```

---

## Task 11: Render Deployment Config

**Files:**
- Create: `render.yaml`
- Create: `Dockerfile` (at root — Render builds from root)

**Step 1: Create `render.yaml`**

```yaml
services:
  - type: worker
    name: eudi-wallet-worker
    runtime: docker
    plan: free
    dockerfilePath: ./Dockerfile
    dockerContext: .
    repo: https://github.com/keeltekool/eudi-wallet-tracker
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: NODE_ENV
        value: production
```

Note: `type: worker` (not `web`) — background workers don't expose HTTP ports on Render free tier. They just run the process indefinitely.

**Step 2: Create `Dockerfile`**

```dockerfile
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY worker/package.json worker/

# Install all dependencies
RUN npm ci --workspaces --include-workspace-root

# Copy source
COPY src/ src/
COPY worker/src/ worker/src/
COPY tsconfig.json ./
COPY worker/tsconfig.json worker/

# Build TypeScript
RUN npx tsc -p worker/tsconfig.json

# Run the worker
CMD ["node", "dist/worker/worker/src/index.js"]
```

**Step 3: Verify the build locally**

```bash
npx tsc -p worker/tsconfig.json --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add render.yaml Dockerfile
git commit -m "feat: Render deployment config for background worker"
```

---

## ── CHECKPOINT: Worker Runtime ──

**Verify:**
- [ ] `npx tsc -p worker/tsconfig.json --noEmit` — no TypeScript errors
- [ ] `npm test` — all tests still pass
- [ ] `render.yaml` exists with worker type + DATABASE_URL env var
- [ ] Dockerfile builds the TypeScript correctly

---

## Task 12: Seed 36 Sources

**Files:**
- Create: `worker/src/seed.ts`

This seed script pre-populates all 36 sources from `docs/source-inventory.md` so the worker has data to scrape on first run.

**Step 1: Create `worker/src/seed.ts`**

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb } from "../src/db/index";
import { sources } from "../src/db/schema";
import type { SourceConfig } from "../src/db/schema";

type SeedSource = {
  name: string;
  url: string;
  type: "rss" | "css";
  category: string;
  config: SourceConfig;
};

const seedSources: SeedSource[] = [
  // ── RSS Sources ──────────────────────────────────
  {
    name: "Biometric Update — EUDI",
    url: "https://www.biometricupdate.com/tag/eu-digital-identity-wallet",
    type: "rss",
    category: "industry",
    config: { feedUrl: "https://www.biometricupdate.com/tag/eu-digital-identity-wallet/feed" },
  },
  {
    name: "OpenID Foundation News",
    url: "https://openid.net/news/",
    type: "rss",
    category: "technical-standards",
    config: { feedUrl: "https://openid.net/feed/" },
  },
  {
    name: "GitHub ARF Releases",
    url: "https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework/releases",
    type: "rss",
    category: "technical-standards",
    config: { feedUrl: "https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework/releases.atom" },
  },
  {
    name: "APTITUDE LSP News",
    url: "https://aptitude.digital-identity-wallet.eu/news/",
    type: "rss",
    category: "regulation",
    config: { feedUrl: "https://aptitude.digital-identity-wallet.eu/feed/" },
  },
  {
    name: "Euractiv Tech",
    url: "https://www.euractiv.com/sections/tech/",
    type: "rss",
    category: "regulation",
    config: { feedUrl: "https://www.euractiv.com/sections/tech/feed/" },
  },
  {
    name: "Identity Week News",
    url: "https://identityweek.net/news/",
    type: "rss",
    category: "industry",
    config: { feedUrl: "https://identityweek.net/feed/" },
  },
  {
    name: "NOBID Consortium News",
    url: "https://nobidconsortium.com/news/",
    type: "rss",
    category: "national-implementation",
    config: { feedUrl: "https://nobidconsortium.com/feed/" },
  },
  {
    name: "DC4EU News",
    url: "https://dc4eu.eu/news-and-events/",
    type: "rss",
    category: "regulation",
    config: { feedUrl: "https://dc4eu.eu/feed/" },
  },
  {
    name: "FIDO Alliance News",
    url: "https://fidoalliance.org/news/",
    type: "rss",
    category: "technical-standards",
    config: { feedUrl: "https://fidoalliance.org/feed/" },
  },
  {
    name: "Goode Intelligence Blog",
    url: "https://www.goodeintelligence.com/blog/",
    type: "rss",
    category: "market-analysis",
    config: { feedUrl: "https://www.goodeintelligence.com/feed/" },
  },
  {
    name: "W3C VC Working Group",
    url: "https://www.w3.org/groups/wg/vc/publications/",
    type: "rss",
    category: "technical-standards",
    config: { feedUrl: "https://www.w3.org/groups/wg/vc/feed/" },
  },
  // ── GitHub Atom Feeds (treated as RSS) ──────────
  {
    name: "EUDI Standards & Technical Specs",
    url: "https://github.com/eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications/releases",
    type: "rss",
    category: "technical-standards",
    config: { feedUrl: "https://github.com/eu-digital-identity-wallet/eudi-doc-standards-and-technical-specifications/releases.atom" },
  },
  {
    name: "EUDI Verifier Endpoint",
    url: "https://github.com/eu-digital-identity-wallet/eudi-srv-verifier-endpoint/releases",
    type: "rss",
    category: "technical-standards",
    config: { feedUrl: "https://github.com/eu-digital-identity-wallet/eudi-srv-verifier-endpoint/releases.atom" },
  },
  {
    name: "EUDI PID Issuer",
    url: "https://github.com/eu-digital-identity-wallet/eudi-srv-pid-issuer/releases",
    type: "rss",
    category: "technical-standards",
    config: { feedUrl: "https://github.com/eu-digital-identity-wallet/eudi-srv-pid-issuer/releases.atom" },
  },
  {
    name: "walt.id Identity Toolkit",
    url: "https://github.com/walt-id/waltid-identity/releases",
    type: "rss",
    category: "technical-standards",
    config: { feedUrl: "https://github.com/walt-id/waltid-identity/releases.atom" },
  },
  {
    name: "OWF EUDIPLO",
    url: "https://github.com/openwallet-foundation-labs/eudiplo/releases",
    type: "rss",
    category: "technical-standards",
    config: { feedUrl: "https://github.com/openwallet-foundation-labs/eudiplo/releases.atom" },
  },
  {
    name: "Italy EUDI Wallet Docs",
    url: "https://github.com/italia/eid-wallet-it-docs/releases",
    type: "rss",
    category: "national-implementation",
    config: { feedUrl: "https://github.com/italia/eid-wallet-it-docs/releases.atom" },
  },
  // ── CSS Scrape Sources ──────────────────────────
  // These start with empty selectors — will be configured via admin
  // using Claude API one-off analysis (ADM-02)
  {
    name: "EC EUDI Wallet Confluence News",
    url: "https://ec.europa.eu/digital-building-blocks/sites/display/EUDIGITALIDENTITYWALLET/News",
    type: "css",
    category: "regulation",
    config: {},
  },
  {
    name: "KuppingerCole Blog",
    url: "https://www.kuppingercole.com/blog",
    type: "css",
    category: "market-analysis",
    config: {},
  },
  {
    name: "Signicat Blog",
    url: "https://www.signicat.com/blog",
    type: "css",
    category: "industry",
    config: {},
  },
  {
    name: "walt.id Blog",
    url: "https://walt.id/blog",
    type: "css",
    category: "technical-standards",
    config: {},
  },
  {
    name: "RIA Estonia News",
    url: "https://www.ria.ee/en/news",
    type: "css",
    category: "national-implementation",
    config: {},
  },
  {
    name: "Scytáles Blog",
    url: "https://scytales.com/blog",
    type: "css",
    category: "industry",
    config: {},
  },
  {
    name: "Sphereon News",
    url: "https://sphereon.com/news-and-insights/",
    type: "css",
    category: "industry",
    config: {},
  },
  {
    name: "LVRTC Latvia News",
    url: "https://www.lvrtc.lv/en/news/",
    type: "css",
    category: "national-implementation",
    config: {},
  },
  {
    name: "Cybernetica News",
    url: "https://cyber.ee/resources/news/",
    type: "css",
    category: "national-implementation",
    config: {},
  },
  {
    name: "SK ID Solutions Newsroom",
    url: "https://www.skidsolutions.eu/newsroom/",
    type: "css",
    category: "industry",
    config: {},
  },
  {
    name: "e-Estonia News",
    url: "https://e-estonia.com/news-and-podcast/",
    type: "css",
    category: "national-implementation",
    config: {},
  },
  {
    name: "iProov Blog",
    url: "https://www.iproov.com/blog",
    type: "css",
    category: "security-privacy",
    config: {},
  },
  {
    name: "Intesi Group News",
    url: "https://www.intesigroup.com/en/news/",
    type: "css",
    category: "industry",
    config: {},
  },
  {
    name: "WE BUILD Consortium",
    url: "https://webuildconsortium.eu/",
    type: "css",
    category: "regulation",
    config: {},
  },
  {
    name: "Cloud Signature Consortium News",
    url: "https://cloudsignatureconsortium.org/category/news/",
    type: "css",
    category: "technical-standards",
    config: {},
  },
  {
    name: "OpenWallet Foundation Blog",
    url: "https://openwallet.foundation/blog/",
    type: "css",
    category: "technical-standards",
    config: {},
  },
  {
    name: "The Paypers — Digital Identity",
    url: "https://thepaypers.com/digital-identity/news",
    type: "css",
    category: "market-analysis",
    config: {},
  },
  {
    name: "Namirial Blog",
    url: "https://www.namirial.com/en/blog/",
    type: "css",
    category: "industry",
    config: {},
  },
  {
    name: "Germany EUDI OpenCode Hub",
    url: "https://bmi.usercontent.opencode.de/eudi-wallet/eidas2/en/news/",
    type: "css",
    category: "national-implementation",
    config: {},
  },
];

async function seed() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const db = createDb(DATABASE_URL);

  console.log(`Seeding ${seedSources.length} sources...`);

  for (const source of seedSources) {
    await db.insert(sources).values(source).onConflictDoNothing();
    console.log(`  ✓ ${source.name} (${source.type})`);
  }

  console.log(`Done. ${seedSources.length} sources seeded.`);
  console.log(
    "\nNote: CSS sources have empty selectors. Configure them via admin (Phase 2) or manually."
  );
  console.log(
    "Only RSS/Atom sources (17 total) will produce articles until CSS selectors are configured."
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

**Step 2: Add seed script to worker `package.json`**

Add to `worker/package.json` scripts:
```json
{
  "seed": "tsx src/seed.ts"
}
```

**Step 3: Run the seed**

```bash
cd worker && npm run seed && cd ..
```

**Step 4: Verify in Drizzle Studio**

```bash
npm run db:studio
```

Confirm 36 sources in the `sources` table. 17 RSS sources with feedUrl configured, 18 CSS sources with empty config, 1 GitHub (ARF) already counted in RSS.

**Step 5: Commit**

```bash
git add worker/src/seed.ts worker/package.json
git commit -m "feat: seed 36 EUDI sources (17 RSS + 18 CSS + 6 GitHub Atom)"
```

---

## Task 13: First Live Scrape Test

**Step 1: Run manual scrape (RSS sources only — CSS have no selectors yet)**

```bash
cd worker && npm run scrape && cd ..
```

**Step 2: Check output**

Expected console output:
- 17 RSS/Atom sources produce articles (varies by feed freshness)
- 18 CSS sources produce 0 articles (no selectors configured — this is expected)
- No crashes, graceful error handling

**Step 3: Verify in Drizzle Studio**

```bash
npm run db:studio
```

Check:
- [ ] `scrape_runs` table has 1 row with `status: success`
- [ ] `articles` table has articles with `status: pending`
- [ ] `sources` table has `last_scraped_at` timestamps updated
- [ ] Articles have valid titles, URLs, url_hash values

**Step 4: Run scrape again to verify deduplication**

```bash
cd worker && npm run scrape && cd ..
```

Check `scrape_runs` — second run should show fewer (or zero) new articles since the same URLs are deduplicated.

**Step 5: Commit + push**

```bash
git add -A
git commit -m "chore: first successful live scrape verified"
git push
```

---

## ── CHECKPOINT: Seed & Verify (Phase 1 Complete) ──

**Full E2E Verification:**
- [ ] `npm test` — all tests pass
- [ ] 36 sources in Neon `sources` table
- [ ] Manual scrape produced pending articles from RSS feeds
- [ ] Deduplication works (second scrape = fewer new articles)
- [ ] `scrape_runs` table logs each run correctly
- [ ] CSS sources gracefully produce 0 articles (no selectors yet)
- [ ] TypeScript compiles: `npx tsc -p worker/tsconfig.json --noEmit`
- [ ] GitHub repo up to date

**NOT done yet (future phases):**
- Render deployment (deploy after Phase 2 admin is built so we can monitor)
- CSS selector configuration (Phase 2 admin)
- AI curation (Phase 4)

---

## File Tree Summary (Phase 1)

```
eudi-wallet-tracker/
├── docs/
│   ├── plans/
│   │   ├── 2026-03-26-brd.md
│   │   └── 2026-03-26-phase1-pipeline.md
│   └── source-inventory.md
├── src/
│   ├── db/
│   │   ├── schema.ts          # Drizzle schema (sources, articles, scrape_runs)
│   │   └── index.ts            # Neon DB client factory
│   └── lib/
│       ├── hash.ts             # URL + content hashing
│       ├── validate.ts         # Article validation
│       └── __tests__/
│           ├── hash.test.ts
│           └── validate.test.ts
├── worker/
│   ├── src/
│   │   ├── index.ts            # Cron entry point (Wed+Sat 06:00 UTC)
│   │   ├── run-scrape.ts       # Manual trigger
│   │   ├── orchestrator.ts     # Main scrape loop
│   │   ├── store.ts            # Dedup + insert
│   │   ├── seed.ts             # 36 source seed data
│   │   ├── __tests__/
│   │   │   └── store.test.ts
│   │   └── parsers/
│   │       ├── types.ts        # ParseResult, ParserConfig
│   │       ├── index.ts        # Router (rss/css dispatch)
│   │       ├── rss.ts          # rss-parser wrapper
│   │       ├── css.ts          # Cheerio scraper
│   │       └── __tests__/
│   │           ├── rss.test.ts
│   │           ├── css.test.ts
│   │           └── index.test.ts
│   ├── package.json
│   └── tsconfig.json
├── drizzle/                    # Generated migrations
├── drizzle.config.ts
├── tsconfig.json
├── package.json
├── Dockerfile
├── render.yaml
├── .gitignore
└── .env.local                  # Never committed
```
