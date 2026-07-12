import Parser from "rss-parser";
import type { RawItem } from "../types";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "promppy-feed-bot/0.1 (+https://promppy.com)" },
});

type Entry = { link?: string; title?: string; isoDate?: string; contentSnippet?: string };

async function fetchListing(url: string): Promise<Entry[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items ?? []) as Entry[];
  } catch {
    // One listing (e.g. a 429) failing shouldn't kill the whole Reddit source.
    return [];
  }
}

/**
 * Trending AI posts from Reddit. Reddit's JSON API 403s unauthenticated
 * clients, but RSS is open. We merge two RSS listings to rank by likes AND
 * recency (RSS exposes neither score nor lets us sort, so listing order is the
 * signal):
 *   - top?t=day  → most-upvoted in the last 24h (the "likes" ranking)
 *   - hot        → currently active (recency)
 * top is prioritized, then hot fills in. Dedup by URL. The LLM gate
 * (classify.ts) decides which are genuinely useful vs community chatter.
 */
export async function fetchReddit(
  sourceId: string,
  subreddits: string[],
  maxItems = 40
): Promise<RawItem[]> {
  const multi = subreddits.join("+");
  const [top, hot] = await Promise.all([
    fetchListing(`https://www.reddit.com/r/${multi}/top.rss?t=day&limit=${maxItems}`),
    fetchListing(`https://www.reddit.com/r/${multi}/hot.rss?limit=${maxItems}`),
  ]);
  if (top.length === 0 && hot.length === 0) {
    throw new Error("reddit: both top and hot listings failed (rate limited?)");
  }

  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const it of [...top, ...hot]) {
    if (out.length >= maxItems) break;
    if (!it.link || !it.title) continue;
    if (/^r\/\w+ rules|^AMA announcement/i.test(it.title)) continue;
    if (seen.has(it.link)) continue;
    seen.add(it.link);
    const sub = it.link.match(/reddit\.com\/(r\/\w+)/)?.[1] ?? "reddit";
    out.push({
      sourceId,
      url: it.link,
      title: it.title.trim(),
      publishedAt: it.isoDate ?? null,
      excerpt: `Trending on ${sub}. ${(it.contentSnippet ?? "").slice(0, 800)}`,
    });
  }
  return out;
}
