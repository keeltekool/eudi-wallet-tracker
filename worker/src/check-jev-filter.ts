/**
 * Self-check for the Jev relevance filter, on inline fixtures (never DB rows).
 * Run from worker/src: npx tsx check-jev-filter.ts
 */
import { config } from "dotenv";
config({ path: "../../.env.local" });

import { jevScore, JEV_THRESHOLD } from "./jev-filter";

async function main() {
  const key = process.env.TYPESAFE_API_KEY;
  let failed = 0;
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
    if (!ok) failed++;
  };

  const bad = await jevScore("not-a-key", { title: "Germany unveils national EUDI wallet", source: "Biometric Update", fullText: null });
  check("bad key returns null", bad === null, String(bad));

  if (!key) {
    console.log("SKIP live fixtures: TYPESAFE_API_KEY not set");
  } else {
    const onTopic = await jevScore(key, {
      title: "Germany unveils national EUDI wallet 'd-you'",
      source: "Biometric Update",
      fullText: "Germany has unveiled its official national EUDI wallet, branded d-you, which will hold the PID and let citizens sign documents with a qualified electronic signature under eIDAS 2.0.",
    });
    check("EUDI wallet news passes", onTopic !== null && onTopic >= JEV_THRESHOLD, String(onTopic));

    const offTopic = await jevScore(key, {
      title: "Identity & Access Governance 2026: Trends, Market Leaders & Selection Criteria",
      source: "KuppingerCole",
      fullText: "Modern enterprises depend on thousands of users, roles, applications, and entitlements, yet many access governance programs still rely on periodic reviews, manual approvals, and scattered audit evidence.",
    });
    check("enterprise IAM report drops", offTopic !== null && offTopic < JEV_THRESHOLD, String(offTopic));
  }
  process.exit(failed ? 1 : 0);
}

main();
