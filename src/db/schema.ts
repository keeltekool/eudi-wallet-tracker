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
  "relevant",
  "irrelevant",
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
    sourceId: integer("source_id").notNull(),
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

// ── Living Doc ────────────────────────────────────

export const livingDoc = pgTable("living_doc", {
  id: serial("id").primaryKey(),
  section: text("section").notNull(), // "bible" or "update"
  content: text("content").notNull(),
  runDate: timestamp("run_date", { withTimezone: true }),
  articlesProcessed: integer("articles_processed"),
  sectionsTouched: text("sections_touched").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Newsletter Subscribers ───────────────────────

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
});

// ── Types ──────────────────────────────────────────

export type SourceConfig = {
  feedUrl?: string;
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
