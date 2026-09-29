/**
 * Jev relevance filter (TypeSafe AI's decision model). Replaces the routine's Claude filter stage: every pending
 * article gets relevant/irrelevant at scrape time. Articles Jev can't answer stay pending, and the routine's
 * filter stage judges those leftovers as before.
 * Question, model and threshold come from the backtest in Claude_Projects/jev (KNOWLEDGE.md §11 test F, variant B,
 * 2026-09-29): on the last 300 judged articles it dropped 43 of 73 off-topic articles and kept 34 of 35 that made
 * the brief.
 */
import { and, desc, eq } from "drizzle-orm";
import { articles, sources } from "../../src/db/schema";
import type { Database } from "../../src/db/index";

const API = "https://api.typesafe.ai/v1/systemone";
// JEV_THRESHOLD was fitted together with MODEL and the QUESTIONS text. Editing any of them invalidates it:
// re-fit with Claude_Projects/jev/eval/eudi-filter.mjs first.
const MODEL = "jev-1.13.0";
export const JEV_THRESHOLD = 0.05;
const CONCURRENCY = 5; // TypeSafe allows 1,200 requests/min; ~0.3 s per call

const QUESTIONS = {
  eu_trust: {
    type: "noul",
    instructions:
      "Is `article` about EU digital identity or EU trust services: the EUDI Wallet, eIDAS, national EU wallet or eID schemes, or electronic signatures, seals and the providers behind them?",
    criteria: {
      true: "EUDI Wallet, eIDAS 2.0, the ARF, PID and attestations, any EU country's wallet or eID news, pilots and tenders (NOBID, DC4EU, WE BUILD, POTENTIAL), the European Business Wallet; verifiable-credential and wallet protocols used in the EU (OID4VP, OID4VCI, SD-JWT, OpenID Federation, W3C VC); qualified signatures and seals, QTSPs, remote signing, CSC API, QSCD and HSM certification, PKI and key management for trust services, post-quantum cryptography for signatures or PKI; Smart-ID, Mobile-ID; companies building these (Signicat, walt.id, Sphereon, Namirial, Buypass, Zetes, Ascertia and similar).",
      false:
        "Enterprise or workforce identity and access management (IAM, IGA, PAM, zero trust, SSO, passkeys, access governance) with no EU digital-identity or trust-service angle; general cybersecurity or fraud; identity schemes outside the EU with no EU link; general EU policy (labour, social media, AI Act) that doesn't touch digital identity; general tech; webinars and events without news; unrelated marketing.",
    },
  },
};

export interface FilterArticle {
  title: string;
  source: string | null;
  fullText: string | null;
}

/** Probability that the article is on topic, or null when Jev can't answer. */
export async function jevScore(apiKey: string, a: FilterArticle): Promise<number | null> {
  // Same fields the routine's filter stage sees (app/api/loop op=filter).
  const article = { title: a.title, source: a.source ?? "", excerpt: a.fullText ? a.fullText.slice(0, 300) : "" };
  const body = JSON.stringify({ model: MODEL, state: { article }, questions: QUESTIONS });
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((s) => setTimeout(s, 500 * 2 ** attempt));
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(8_000), // normal call ~0.3 s
      });
      if (r.ok) return (await r.json()).answers.eu_trust.noul;
      if (r.status !== 429 && r.status < 500) return null; // bad key or request: retrying won't help
    } catch {
      // timeout or network error: retry
    }
  }
  return null;
}

/** Marks every pending article relevant or irrelevant. Never throws: a failure leaves articles pending. */
export async function filterPending(db: Database, apiKey: string | undefined): Promise<void> {
  if (!apiKey) {
    console.log("[jev] TYPESAFE_API_KEY not set: pending articles are left for the routine's filter stage");
    return;
  }
  const queue = await db
    .select({ id: articles.id, title: articles.title, fullText: articles.fullText, source: sources.name })
    .from(articles)
    .leftJoin(sources, eq(sources.id, articles.sourceId))
    .where(eq(articles.status, "pending"))
    .orderBy(desc(articles.scrapedAt));
  const total = queue.length;
  let relevant = 0;
  let irrelevant = 0;
  // A null already means 4 failed attempts, so treat Jev as down for the rest of the run instead of paying the
  // retry budget per article (the job has a 10-minute cap).
  let jevDown = false;

  async function worker() {
    for (let a; !jevDown && (a = queue.shift()); ) {
      const score = await jevScore(apiKey!, a);
      if (score === null) {
        jevDown = true;
        return;
      }
      const status = score >= JEV_THRESHOLD ? "relevant" : "irrelevant";
      await db
        .update(articles)
        .set({ status, jevScore: score })
        .where(and(eq(articles.id, a.id), eq(articles.status, "pending")));
      if (status === "relevant") relevant++;
      else irrelevant++;
    }
  }
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } catch (err) {
    jevDown = true;
    console.error(`[jev] filter stopped: ${err instanceof Error ? err.message : String(err)}`);
  }

  const left = total - relevant - irrelevant;
  if (left > 0) console.log(`::warning::Jev filter failed; ${left} of ${total} articles left pending for the routine`);
  console.log(`[jev] ${total} pending: ${relevant} relevant, ${irrelevant} irrelevant, ${left} left pending`);
}
