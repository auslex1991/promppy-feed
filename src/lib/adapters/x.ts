import type { RawItem } from "../types";

/**
 * Posts from X/Twitter via twitterapi.io advanced_search (the official X
 * API's read pricing is prohibitive) — billed per tweet returned, so cost
 * tracks tweet volume, not query count. Three passes per crawl: curated org
 * accounts, curated people (like-thresholded), and an open viral search that
 * catches AI tweets from anyone once they're already popular.
 *
 * Search windows overlap the 15-min crawl on purpose; URL dedup drops
 * re-seen tweets. Missing TWITTERAPI_KEY disables the source silently.
 */
// Org accounts post announcements — every non-reply passes to the gate.
const ORG_ACCOUNTS = [
  "OpenAI", "AnthropicAI", "GoogleDeepMind", "xai", "AIatMeta", "MistralAI",
  "huggingface", "cursor_ai",
  "GoogleAI", "perplexity_ai", "deepseek_ai", "Alibaba_Qwen", "nvidia",
  "LangChainAI", "llama_index", "GroqInc", "Replit", "elevenlabsio",
  "runwayml", "v0",
];

// Personal accounts mix real signal with daily chatter (lunch, lifestyle,
// banter) — only tweets with real engagement enter the pipeline. The 12h
// window lets a slow-burn tweet cross the like threshold on a later crawl
// instead of aging out at 6h with 60 likes; URL dedup absorbs the overlap.
const PEOPLE_ACCOUNTS = [
  "sama", "karpathy", "ylecun", "demishassabis", "DrJimFan", "_akhaliq",
  "swyx", "OfficialLoganK", "alexalbert__", "AndrewYNg",
  "emollick", "rowancheung", "mckaywrigley", "goodside", "jeremyphoward",
  "hwchase17", "bindureddy", "minchoi", "levelsio", "LinusEkenstam",
  "gdb", "simonw", "aidan_mclau", "nearcyan",
];

// The LLM gate judges substance from here — 50 likes is "people noticed",
// not "already famous", so good posts surface hours earlier.
const MIN_LIKES_PEOPLE = 50;
const PEOPLE_WINDOW = "12h";

// Open discovery: viral AI tweets from ANYONE, not just the curated roster.
// min_faves filters server-side, so we only pay for already-viral tweets.
// VIRAL_MIN_LIKES re-checks client-side in case the operator is ever ignored
// upstream — without it, a keyword this broad would flood the pipeline.
const VIRAL_MIN_LIKES = 500;
const VIRAL_QUERY =
  `(OpenAI OR Anthropic OR Claude OR ChatGPT OR Gemini OR LLM OR DeepSeek OR ` +
  `Qwen OR "open weights" OR "AI agent" OR AGI) ` +
  `min_faves:${VIRAL_MIN_LIKES} -filter:replies lang:en`;

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

async function search(key: string, query: string): Promise<XTweet[]> {
  const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?queryType=Latest&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "X-API-Key": key },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`twitterapi.io HTTP ${res.status}`);
  const data = (await res.json()) as { tweets?: XTweet[] };
  return data.tweets ?? [];
}

function accountQueries(accounts: string[], window: string): string[] {
  const chunks: string[][] = [];
  for (let i = 0; i < accounts.length; i += CHUNK_SIZE) chunks.push(accounts.slice(i, i + CHUNK_SIZE));
  return chunks.map((c) => `(${c.map((a) => `from:${a}`).join(" OR ")}) within_time:${window}`);
}

export async function fetchX(sourceId: string, maxItems = 50): Promise<RawItem[]> {
  const key = process.env.TWITTERAPI_KEY;
  if (!key) return [];

  // Orgs: short window (announcements matter immediately, no like-threshold to
  // wait for) — cheaper under the 15-min crawl cadence. People: 12h so tweets
  // have time to accumulate the like threshold. Viral: open search, anyone.
  const queries = [
    ...accountQueries(ORG_ACCOUNTS, "2h"),
    ...accountQueries(PEOPLE_ACCOUNTS, PEOPLE_WINDOW),
    `${VIRAL_QUERY} within_time:6h`,
  ];
  const results = await Promise.all(queries.map((q) => search(key, q)));
  const orgs = new Set(ORG_ACCOUNTS.map((a) => a.toLowerCase()));
  const roster = new Set(
    [...ORG_ACCOUNTS, ...PEOPLE_ACCOUNTS].map((a) => a.toLowerCase())
  );
  const tweets = results.flat();

  return tweets
    .filter((t) => {
      const text = t.text ?? "";
      if (!t.url || text.length <= 30 || t.isReply || text.startsWith("RT @")) return false;
      const user = (t.author?.userName ?? "").toLowerCase();
      // Org announcements pass; roster people need real engagement; anyone
      // else came from the viral search and must actually be viral.
      if (orgs.has(user)) return true;
      if (roster.has(user)) return (t.likeCount ?? 0) >= MIN_LIKES_PEOPLE;
      return (t.likeCount ?? 0) >= VIRAL_MIN_LIKES;
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
