/**
 * COPY — Idea Radar DB schema.
 *
 * Kept in sync manually with `idea-radar/src/db/schema.ts`.
 * Purpose: type-safe admin queries against the Idea Radar Neon DB from the
 * federated EUDI admin UI.
 *
 * DO NOT run Drizzle migrations from this file — this repo does not own the
 * Idea Radar schema; the idea-radar project's `drizzle-kit push` is the
 * authoritative source of DDL.
 */
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  pgEnum,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const sourceTypeEnum = pgEnum("source_type", [
  "producthunt",
  "github",
  "hackernews",
  "devto",
  "reddit",
  "rss",
]);

export const discoveryStatusEnum = pgEnum("discovery_status", [
  "pending",
  "relevant",
  "irrelevant",
  "accepted",
  "rejected",
]);

export const userFeedbackEnum = pgEnum("user_feedback", ["spark", "pass"]);

export const scrapeRunStatusEnum = pgEnum("scrape_run_status", [
  "running",
  "success",
  "failed",
]);

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: sourceTypeEnum("type").notNull(),
  config: jsonb("config").default({}),
  active: boolean("active").notNull().default(true),
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  lastProjectCount: integer("last_project_count"),
  acceptanceRate: real("acceptance_rate"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const discoveries = pgTable(
  "discoveries",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").notNull(),
    url: text("url").notNull(),
    urlHash: varchar("url_hash", { length: 64 }).notNull(),
    contentHash: varchar("content_hash", { length: 64 }),
    title: text("title").notNull(),
    description: text("description"),
    author: text("author"),
    techStack: text("tech_stack").array().default([]),
    stars: integer("stars"),
    upvotes: integer("upvotes"),
    status: discoveryStatusEnum("status").notNull().default("pending"),
    feasibilityScore: real("feasibility_score"),
    noveltyScore: real("novelty_score"),
    stretchScore: real("stretch_score"),
    compositeScore: real("composite_score"),
    summary: text("summary"),
    categories: text("categories").array().default([]),
    rejectionReason: text("rejection_reason"),
    isWildcard: boolean("is_wildcard").notNull().default(false),
    userFeedback: userFeedbackEnum("user_feedback"),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("discoveries_url_hash_idx").on(table.urlHash)]
);

export const builderProfile = pgTable("builder_profile", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  projectCount: integer("project_count"),
});

export const scrapeRuns = pgTable("scrape_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: scrapeRunStatusEnum("status").notNull().default("running"),
  sourcesScraped: integer("sources_scraped").default(0),
  discoveriesFound: integer("discoveries_found").default(0),
  preFilterDropped: integer("pre_filter_dropped").default(0),
  aiAccepted: integer("ai_accepted").default(0),
  aiRejected: integer("ai_rejected").default(0),
  errors: jsonb("errors").default([]),
});

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Discovery = typeof discoveries.$inferSelect;
export type ScrapeRun = typeof scrapeRuns.$inferSelect;
