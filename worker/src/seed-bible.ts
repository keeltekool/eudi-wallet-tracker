import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { readFileSync } from "fs";

config({ path: "../.env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function seedBible() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx src/seed-bible.ts <path-to-markdown>");
    process.exit(1);
  }

  const content = readFileSync(filePath, "utf-8");

  await sql`DELETE FROM living_doc WHERE section = 'bible'`;
  await sql`
    INSERT INTO living_doc (section, content, run_date)
    VALUES ('bible', ${content}, NOW())
  `;

  console.log(`Bible seeded: ${content.length} chars`);
}

seedBible().catch(console.error);
