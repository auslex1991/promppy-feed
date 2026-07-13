import type { RawItem } from "../types";

/**
 * Trending posts from curated X/Twitter accounts via twitterapi.io (the
 * official X API's read pricing is prohibitive). ONE advanced_search call per
 * crawl covers every account — billed per tweet returned, so cost tracks the
 * handful of new tweets per hour, not the account count.
 *
 * within_time:3h overlaps the hourly crawl on purpose; URL dedup drops
 * re-seen tweets. Missing TWITTERAPI_KEY disables the source silently.
 */
const ACCOUNTS = [
  // labs & orgs
  "OpenAI", "AnthropicAI", "GoogleDeepMind", "xai", "AIatMeta", "MistralAI",
  "huggingface", "cursor_ai",
  // high-signal individuals
  "sama", "karpathy", "ylecun", "demishassabis", "DrJimFan", "_akhaliq",
  "swyx", "OfficialLoganK", "alexalbert__", "AndrewYNg",
];

interface XTweet {
  id: string;
  url: string;
  text?: string;
  createdAt?: string;
  likeCount?: number;
  isReply?: boolean;
  author?: { userName?: string };
}

export async function fetchX(sourceId: string, maxItems = 25): Promise<RawItem[]> {
  const key = process.env.TWITTERAPI_KEY;
  if (!key) return [];

  const query = `(${ACCOUNTS.map((a) => `from:${a}`).join(" OR ")}) within_time:3h`;
  const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?queryType=Latest&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "X-API-Key": key },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`twitterapi.io HTTP ${res.status}`);
  const data = (await res.json()) as { tweets?: XTweet[] };
  const tweets = data.tweets ?? [];

  return tweets
    .filter((t) => {
      const text = t.text ?? "";
      return t.url && text.length > 30 && !t.isReply && !text.startsWith("RT @");
    })
    .slice(0, maxItems)
    .map((t) => {
      const text = (t.text ?? "").replace(/\s+/g, " ").trim();
      const user = t.author?.userName ?? "unknown";
      return {
        sourceId,
        url: t.url,
        title: `@${user}: ${text.slice(0, 130)}`,
        publishedAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
        excerpt: `Post by @${user} on X (좋아요 ${t.likeCount ?? 0}). ${text}`.slice(0, 900),
      };
    });
}
