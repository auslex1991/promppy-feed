import Parser from "rss-parser";
import type { RawItem } from "../types";

function makeParser(timeoutMs: number) {
  return new Parser({
    timeout: timeoutMs,
    headers: { "User-Agent": "promppy-feed-bot/0.1 (+https://promppy.com)" },
  });
}

const parser = makeParser(15000);

export async function fetchRss(
  sourceId: string,
  feedUrl: string,
  maxItems = 30,
  timeoutMs?: number
): Promise<RawItem[]> {
  const feed = await (timeoutMs ? makeParser(timeoutMs) : parser).parseURL(feedUrl);
  return (feed.items ?? []).slice(0, maxItems).flatMap((it) => {
    if (!it.link || !it.title) return [];
    const excerpt = (it.contentSnippet || it.content || it.summary || "").toString();
    return [
      {
        sourceId,
        url: it.link,
        title: it.title.trim(),
        publishedAt: it.isoDate ?? (it.pubDate ? new Date(it.pubDate).toISOString() : null),
        excerpt,
      },
    ];
  });
}
