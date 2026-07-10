import { NextRequest, NextResponse } from "next/server";
import { runCrawl } from "@/lib/crawl";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when the env var is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const stats = await runCrawl();
  return NextResponse.json(stats);
}
