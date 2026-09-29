import { NextResponse } from "next/server";
import { sendLatestUpdate } from "@/src/lib/newsletter";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(await sendLatestUpdate());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Newsletter send error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
