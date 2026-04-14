import { db } from "@/src/db/client";
import { livingDoc } from "@/src/db/schema";
import { eq, desc } from "drizzle-orm";
import { Header } from "../components/header";
import { StrategyContent } from "./strategy-content";

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const bibleRow = await db
    .select()
    .from(livingDoc)
    .where(eq(livingDoc.section, "bible"))
    .limit(1);

  const updates = await db
    .select()
    .from(livingDoc)
    .where(eq(livingDoc.section, "update"))
    .orderBy(desc(livingDoc.runDate));

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-10 py-8">
        <StrategyContent
          bible={bibleRow[0]?.content || ""}
          updates={updates.map((u) => ({
            content: u.content,
            runDate: u.runDate?.toISOString() || "",
            articlesProcessed: u.articlesProcessed || 0,
            sectionsTouched: (u.sectionsTouched as string[]) || [],
          }))}
        />
      </main>
    </div>
  );
}
