import { getFeed, lastSuccessfulRun } from "./db";
import { SOURCE_NAMES } from "./sources";
import type { FeedPayload } from "./types";

/** Single builder for the feed payload — used by both the SSR page and /api/feed. */
export async function getFeedPayload(limit = 100): Promise<FeedPayload> {
  const [feed, lastRun] = await Promise.all([getFeed(limit), lastSuccessfulRun()]);
  return {
    items: feed.map((i) => ({ ...i, sourceName: SOURCE_NAMES[i.sourceId] ?? i.sourceId })),
    lastCrawlAt: lastRun?.finished_at ?? null,
    serverNow: new Date().toISOString(),
  };
}
