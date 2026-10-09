import { NextResponse } from "next/server";
import { getLatestPublished } from "@/lib/db";

/**
 * The live parts of an item page — ticker, 다음 뉴스, 최신 뉴스 — read this
 * instead of being baked into the page. That is what lets item pages cache
 * for 30 days: their own content never changes, only these lists did, and
 * re-rendering 9k+ distinct item URLs for fresh lists was ~half the Vercel
 * bill (ISR writes). CDN caching collapses every reader into one DB read per
 * minute per region; the crawl only publishes every ~15 minutes anyway.
 */
const CACHE = "public, s-maxage=60, stale-while-revalidate=600";

export async function GET() {
  // excludeId 0 matches nothing: the client drops the page's own item itself.
  const items = await getLatestPublished(0, 40);
  return NextResponse.json(
    {
      items: items.map((i) => ({
        id: i.id,
        tier: i.tier,
        headlineKo: i.headlineKo,
        whyKo: i.whyKo,
        publishedAt: i.publishedAt,
      })),
    },
    { headers: { "Cache-Control": CACHE } }
  );
}
