import Parser from "rss-parser";
import type { RawItem } from "../types";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "promppy-feed-bot/0.1 (+https://promppy.com)" },
});

/**
 * Trending AI posts from Reddit via the multireddit hot.rss feed. Reddit's
 * JSON API 403s unauthenticated clients, but RSS is open; hot-ranking order
 * stands in for a score threshold — we take only the top of hot. The LLM
 * skip gate filters remaining community chatter (see classify.ts).
 */
export async function fetchReddit(sourceId: string, subreddits: string[], maxItems = 15): Promise<RawItem[]> {
  const feed = await parser.parseURL(
    `https://www.reddit.com/r/${subreddits.join("+")}/hot.rss?limit=${maxItems + 10}`
  );
  return (feed.items ?? [])
    .filter((it) => it.link && it.title && !/^r\/\w+ rules|^AMA announcement/i.test(it.title))
    .slice(0, maxItems)
    .map((it) => {
      const sub = it.link!.match(/reddit\.com\/(r\/\w+)/)?.[1] ?? "reddit";
      return {
        sourceId,
        url: it.link!,
        title: it.title!.trim(),
        publishedAt: it.isoDate ?? null,
        excerpt: `Trending on ${sub}. ${(it.contentSnippet ?? "").slice(0, 800)}`,
      };
    });
}
