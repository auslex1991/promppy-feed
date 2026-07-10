import type { RawItem } from "../types";
import { isAiRelevant } from "../relevance";

interface HnHit {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  created_at: string;
}

/** HN front page via Algolia; keep AI-relevant items above a points threshold (SOURCES.md #11). */
export async function fetchHackerNews(sourceId: string): Promise<RawItem[]> {
  const res = await fetch(
    "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30",
    { headers: { "User-Agent": "promppy-feed-bot/0.1" }, signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error(`HN Algolia HTTP ${res.status}`);
  const data = (await res.json()) as { hits: HnHit[] };
  return data.hits
    .filter((h) => h.points >= 80 && h.title && isAiRelevant(h.title, h.url ?? ""))
    .map((h) => ({
      sourceId,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      title: h.title.trim(),
      publishedAt: h.created_at,
      excerpt: `Hacker News front page, ${h.points} points`,
    }));
}
