import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: "../.env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function updateLivingDoc() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  const data = JSON.parse(input);

  if (data.bible) {
    await sql`DELETE FROM living_doc WHERE section = 'bible'`;
    await sql`
      INSERT INTO living_doc (section, content, run_date)
      VALUES ('bible', ${data.bible}, NOW())
    `;
    console.log("Bible updated in Neon");
  }

  if (data.update) {
    await sql`
      INSERT INTO living_doc (section, content, run_date, articles_processed, sections_touched)
      VALUES (
        'update',
        ${data.update.content},
        ${data.update.runDate}::timestamptz,
        ${data.update.articlesProcessed},
        ${data.update.sectionsTouched}
      )
    `;
    console.log(
      `Update log inserted: ${data.update.sectionsTouched.length} sections touched`
    );

    // Trigger newsletter send
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://eudi-wallet-tracker.vercel.app";
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      try {
        const sendRes = await fetch(`${baseUrl}/api/newsletter/send`, {
          headers: { Authorization: `Bearer ${cronSecret}` },
        });
        const sendData = await sendRes.json();
        console.log("Newsletter:", JSON.stringify(sendData));
      } catch (err) {
        console.error("Newsletter trigger failed (update still saved):", err);
      }
    } else {
      console.log("CRON_SECRET not set, skipping newsletter trigger");
    }
  }
}

updateLivingDoc().catch(console.error);
