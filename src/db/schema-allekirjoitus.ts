/**
 * COPY — Allekirjoitus Competitive Intel Tracker DB schema.
 *
 * Kept in sync manually with `allekirjoitus-competitive-tracker/src/db/schema.ts`.
 * Purpose: type-safe admin queries against the Allekirjoitus Neon DB from the
 * federated EUDI admin UI.
 *
 * DO NOT run Drizzle migrations from this file — this repo does not own the
 * Allekirjoitus schema; the Allekirjoitus project's `drizzle-kit push` is the
 * authoritative source of DDL.
 *
 * V2 TODO: extract this schema into a shared workspace package so sync is automatic.
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

/**
 * `sources` — watched competitor URLs managed via admin UI.
 * One row per URL we want to poll. `theme` is free-form TEXT (TS literal
 * union `Theme` enforces the 7 canonical values at compile time).
 */
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  competitor: text("competitor").notNull(),
  url: text("url").notNull().unique(),
  theme: text("theme").notNull(),
  purpose: text("purpose"),
  active: boolean("active").notNull().default(true),
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  lastStatus: text("last_status"),
  lastContentHash: varchar("last_content_hash", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * `snapshots` — historical scraped markdown per source for diffing.
 * Unique index on (source_id, content_hash) prevents re-storing
 * identical content from repeat scrapes.
 */
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

/**
 * `scrapeRuns` — per-run history. `status` stored as TEXT; TS literal
 * union `ScrapeStatus` enforces "running" | "success" | "failed".
 * `errors` is a JSONB array of structured error records.
 */
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
  briefUpdated: boolean("brief_updated").default(false),
  lccRunId: text("lcc_run_id"),
  errors: jsonb("errors").default(sql`'[]'::jsonb`),
});

// -------------------------------------------------------------------------
// Type exports
// -------------------------------------------------------------------------

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;

export type Snapshot = typeof snapshots.$inferSelect;
export type NewSnapshot = typeof snapshots.$inferInsert;

export type ScrapeRun = typeof scrapeRuns.$inferSelect;
export type NewScrapeRun = typeof scrapeRuns.$inferInsert;

export type Theme =
  | "pricing"
  | "features"
  | "integrations"
  | "eid"
  | "compliance"
  | "market"
  | "eudi-wallet";

export type ScrapeStatus = "running" | "success" | "failed";
