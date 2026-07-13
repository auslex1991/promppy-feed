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
// Org accounts post announcements — every non-reply passes to the gate.
const ORG_ACCOUNTS = [
  "OpenAI", "AnthropicAI", "GoogleDeepMind", "xai", "AIatMeta", "MistralAI",
  "huggingface", "cursor_ai",
];

// Personal accounts mix real signal with daily chatter (lunch, lifestyle,
// banter) — only tweets with real engagement enter the pipeline. The wider
// 6h window gives tweets time to accumulate likes; URL dedup absorbs the
// hourly re-fetch overlap.
const PEOPLE_ACCOUNTS = [
  "sama", "karpathy", "ylecun", "demishassabis", "DrJimFan", "_akhaliq",
  "swyx", "OfficialLoganK", "alexalbert__", "AndrewYNg",
  "emollick", "rowancheung", "mckaywrigley", "goodside", "jeremyphoward",
  "hwchase17", "bindureddy", "minchoi", "levelsio", "LinusEkenstam",
];

const MIN_LIKES_PEOPLE = 100;

// X's search query caps out around 512 chars — chunk the account list so each
// query stays comfortably under it, one search call per chunk per crawl.
const CHUNK_SIZE = 14;

interface XTweet {
  id: string;
  url: string;
  text?: string;
  createdAt?: string;
  likeCount?: number;
  isReply?: boolean;
  author?: { userName?: string };
}

async function searchChunk(key: string, accounts: string[], window: string): Promise<XTweet[]> {
  const query = `(${accounts.map((a) => `from:${a}`).join(" OR ")}) within_time:${window}`;
  const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?queryType=Latest&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "X-API-Key": key },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`twitterapi.io HTTP ${res.status}`);
  const data = (await res.json()) as { tweets?: XTweet[] };
  return data.tweets ?? [];
}

function chunked(accounts: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < accounts.length; i += CHUNK_SIZE) chunks.push(accounts.slice(i, i + CHUNK_SIZE));
  return chunks;
}

export async function fetchX(sourceId: string, maxItems = 30): Promise<RawItem[]> {
  const key = process.env.TWITTERAPI_KEY;
  if (!key) return [];

  const [orgResults, peopleResults] = await Promise.all([
    Promise.all(chunked(ORG_ACCOUNTS).map((c) => searchChunk(key, c, "6h"))),
    Promise.all(chunked(PEOPLE_ACCOUNTS).map((c) => searchChunk(key, c, "6h"))),
  ]);
  const orgs = new Set(ORG_ACCOUNTS.map((a) => a.toLowerCase()));
  const tweets = [...orgResults.flat(), ...peopleResults.flat()];

  return tweets
    .filter((t) => {
      const text = t.text ?? "";
      if (!t.url || text.length <= 30 || t.isReply || text.startsWith("RT @")) return false;
      // Personal accounts must show real engagement; org announcements pass.
      const isOrg = orgs.has((t.author?.userName ?? "").toLowerCase());
      return isOrg || (t.likeCount ?? 0) >= MIN_LIKES_PEOPLE;
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
