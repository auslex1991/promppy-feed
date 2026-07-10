import { NextResponse } from "next/server";
import { getFeed, lastSuccessfulRun } from "@/lib/db";
import { SOURCE_NAMES } from "@/lib/sources";

export async function GET() {
  const [feed, lastRun] = await Promise.all([getFeed(100), lastSuccessfulRun()]);
  const items = feed.map((i) => ({
    ...i,
    sourceName: SOURCE_NAMES[i.sourceId] ?? i.sourceId,
  }));
  return NextResponse.json({
    items,
    lastCrawlAt: lastRun?.finished_at ?? null,
    serverNow: new Date().toISOString(),
  });
}
