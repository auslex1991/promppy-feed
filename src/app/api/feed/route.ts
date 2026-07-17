import { NextRequest, NextResponse } from "next/server";
import { getFeedBefore } from "@/lib/db";
import { getFeedPayload } from "@/lib/feedPayload";
import { SOURCE_NAMES } from "@/lib/sources";

const PAGE_SIZE = 50;

// Every open tab polls this endpoint, and each poll used to run a fresh
// multi-hundred-row query — with a handful of concurrent readers that was
// gigabytes of Neon egress per day and it exhausted the data-transfer quota
// (the DB then refuses ALL connections, taking the feed down). CDN caching
// collapses every concurrent reader into one DB read per window, which is
// plenty: the crawl only publishes every 15 minutes.
const FEED_CACHE = "public, s-maxage=60, stale-while-revalidate=600";
// Older pages are immutable in practice — an item's past never changes.
const PAGE_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(req: NextRequest) {
  // ?before=<ISO> → load-more: older items in reverse-chronological order.
  const before = req.nextUrl.searchParams.get("before");
  if (before) {
    const older = await getFeedBefore(before, PAGE_SIZE);
    const items = older.map((i) => ({ ...i, sourceName: SOURCE_NAMES[i.sourceId] ?? i.sourceId }));
    return NextResponse.json(
      { items, hasMore: older.length === PAGE_SIZE },
      { headers: { "Cache-Control": PAGE_CACHE } }
    );
  }
  return NextResponse.json(await getFeedPayload(100), {
    headers: { "Cache-Control": FEED_CACHE },
  });
}
