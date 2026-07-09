/**
 * COPY — EE AI Builders Watch DB schema (admin-relevant tables only).
 *
 * Kept in sync manually with `idea-radar/src/db/schema-watch.ts` (the
 * authoritative DDL owner — its `drizzle.config.watch.ts` pushes to the
 * `ee-ai-watch` Neon project). DO NOT run migrations from this file.
 *
 * The watch-specific tables (watch_players, watch_changes, watch_signals,
 * watch_posts, watch_memos, watch_brief) are intentionally NOT copied — the
 * admin only manages sources / snapshots / scrape_runs.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/** One row per tracked page. `competitor` = player slug, `theme` = page type. */
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  competitor: text("competitor").notNull(),
  url: text("url").notNull().unique(),
  theme: text("theme").notNull(),
  purpose: text("purpose"),
  active: boolean("active").notNull().default(true),
  discoveredBy: text("discovered_by").notNull().default("seed"),
  needsRender: boolean("needs_render").notNull().default(false),
  failCount: integer("fail_count").notNull().default(0),
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  lastStatus: text("last_status"),
  lastContentHash: varchar("last_content_hash", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const snapshots = pgTable(
  "snapshots",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    scrapedAt: timestamp("scraped_at", { withTimezone: true }).defaultNow(),
    contentMd: text("content_md").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
  },
  (table) => ({
    sourceHashIdx: uniqueIndex("snapshots_source_hash_idx").on(
      table.sourceId,
      table.contentHash,
    ),
  }),
);

export const scrapeRuns = pgTable("scrape_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: text("status").notNull(),
  urlsScraped: integer("urls_scraped").default(0),
  urlsFailed: integer("urls_failed").default(0),
  changesDetected: integer("changes_detected").default(0),
  postsCaptured: integer("posts_captured").default(0),
  socialSweepRan: boolean("social_sweep_ran").notNull().default(false),
  briefUpdated: boolean("brief_updated").default(false),
  lccRunId: text("lcc_run_id"),
  errors: jsonb("errors").default(sql`'[]'::jsonb`),
});

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;

/** Page types for EE AI Builders Watch sources. */
export const EEWATCH_THEMES = [
  "home",
  "services",
  "pricing",
  "blog",
  "about",
  "other",
] as const;
