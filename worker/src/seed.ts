import { config } from "dotenv";
config({ path: "../.env.local" });

import { createDb } from "../../src/db/index";
import { sources } from "../../src/db/schema";
import type { SourceConfig } from "../../src/db/schema";

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
    console.log(`  + ${source.name} (${source.type})`);
  }

  console.log(`\nDone. ${seedSources.length} sources seeded.`);
  console.log(
    "Note: CSS sources have empty selectors. Configure them via admin (Phase 2)."
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
