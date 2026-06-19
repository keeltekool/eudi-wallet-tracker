// COPY — do not migrate from here. The `athlon` repo's drizzle-kit owns the
// DDL for these tables; this is a hand-synced copy used only for type-safe
// admin queries against Athlon's Neon (DATABASE_URL_ATHLON). Keep in sync with
// athlon/src/db/schema.ts.
import {
  pgTable,
  pgEnum,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const entityKindEnum = pgEnum("entity_kind", ["athlete", "team"]);
export const surfaceTypeEnum = pgEnum("surface_type", ["official_page", "public_profile"]);
export const postTypeEnum = pgEnum("post_type", ["status", "photo", "album", "link_share"]);
export const postedAtConfidenceEnum = pgEnum("posted_at_confidence", [
  "time_observed",
  "date_only",
  "year_inferred",
  "unknown",
]);
export const runStatusEnum = pgEnum("run_status", [
  "running",
  "success",
  "failed",
  "stopped_checkpoint",
]);

export const sports = pgTable("sports", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const athletes = pgTable("athletes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  kind: entityKindEnum("kind").notNull().default("athlete"),
  sportId: integer("sport_id")
    .notNull()
    .references(() => sports.id),
  fbUrl: text("fb_url").notNull(),
  surfaceType: surfaceTypeEnum("surface_type").notNull(),
  verified: boolean("verified").default(false),
  active: boolean("active").notNull().default(true),
  bio: text("bio"),
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  lastPostSeenAt: timestamp("last_post_seen_at", { withTimezone: true }),
  imageCount: integer("image_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => athletes.id),
    permalink: text("permalink").notNull(),
    permalinkHash: varchar("permalink_hash", { length: 64 }).notNull(),
    postType: postTypeEnum("post_type"),
    fullText: text("full_text"),
    language: varchar("language", { length: 8 }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedAtConfidence: postedAtConfidenceEnum("posted_at_confidence").default("unknown"),
    mediaType: varchar("media_type", { length: 16 }),
    mediaCount: integer("media_count"),
    engagementReactions: integer("engagement_reactions"),
    engagementComments: integer("engagement_comments"),
    engagementShares: integer("engagement_shares"),
    isOwnPost: boolean("is_own_post").default(true),
    imageUrl: text("image_url"),
    sourceCredit: text("source_credit").default("Facebook"),
    sourceUrl: text("source_url"), // v1.1: clean original-FB-post URL
    sourceDateLabel: text("source_date_label"), // v1.1: original FB posting date (display)
    scrapedAt: timestamp("scraped_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("posts_permalink_hash_idx").on(t.permalinkHash),
    index("posts_scraped_at_idx").on(t.scrapedAt),
    index("posts_athlete_scraped_idx").on(t.athleteId, t.scrapedAt),
  ]
);

export const athleteImages = pgTable(
  "athlete_images",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => athletes.id),
    r2Key: text("r2_key").notNull(),
    r2Url: text("r2_url").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    sourcePermalink: text("source_permalink"),
    width: integer("width"),
    height: integer("height"),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("athlete_images_unique").on(t.athleteId, t.contentHash)]
);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: runStatusEnum("status").notNull().default("running"),
  athletesScanned: integer("athletes_scanned").default(0),
  postsFound: integer("posts_found").default(0),
  postsNew: integer("posts_new").default(0),
  imagesAdded: integer("images_added").default(0),
  notes: text("notes"),
  errors: jsonb("errors").default([]),
});
