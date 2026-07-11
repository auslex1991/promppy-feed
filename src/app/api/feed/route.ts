import { NextRequest, NextResponse } from "next/server";
import { getFeed, getFeedBefore, lastSuccessfulRun } from "@/lib/db";
import { SOURCE_NAMES } from "@/lib/sources";
import type { FeedItem } from "@/lib/types";

const PAGE_SIZE = 50;

function withSourceNames(items: FeedItem[]) {
  return items.map((i) => ({ ...i, sourceName: SOURCE_NAMES[i.sourceId] ?? i.sourceId }));
}

export async function GET(req: NextRequest) {
  // ?before=<ISO> → load-more: older items in reverse-chronological order.
  const before = req.nextUrl.searchParams.get("before");
  if (before) {
    const older = await getFeedBefore(before, PAGE_SIZE);
    return NextResponse.json({ items: withSourceNames(older), hasMore: older.length === PAGE_SIZE });
  }

  // Default: arranged front page + freshness metadata.
  const [feed, lastRun] = await Promise.all([getFeed(100), lastSuccessfulRun()]);
  return NextResponse.json({
    items: withSourceNames(feed),
    lastCrawlAt: lastRun?.finished_at ?? null,
    serverNow: new Date().toISOString(),
  });
}
