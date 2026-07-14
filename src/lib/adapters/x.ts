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
  // User-curated batch (2026-07-14) — AI content/tips accounts.
  "charliejhills", "MyWestLord", "ahmedrann", "0xJeff", "AnatoliKopadze",
  "ai_explorer25", "undefinedKi", "humzaakhalid", "cyrilXBT", "Star_Knight12",
  "CodeswithClara",
  // User-curated batch 2 (2026-07-14).
  "AlexFinn", "petergostev", "theo", "Ciri_ai", "hqmank", "DavidOndrej1",
  "_avichawla", "DataChaz", "ns123abc", "alexcooldev",
];

// The LLM gate judges substance from here — 5 likes only filters the posts
// literally nobody engaged with; quality judgment belongs to the gate.
// Kept this low on purpose: roster announcements often have few likes when
// our 15-min crawl sees them first (user request 2026-07-14).
const MIN_LIKES_PEOPLE = 5;
const PEOPLE_WINDOW = "12h";

// Open discovery: viral AI tweets from ANYONE, not just the curated roster.
// min_faves filters server-side, so we only pay for already-viral tweets.
// VIRAL_MIN_LIKES re-checks client-side in case the operator is ever ignored
// upstream — without it, a keyword this broad would flood the pipeline.
// Kept in sync with the 좋아요 bar in classify.ts's GATE_PROMPT/SYSTEM_PROMPT.
const VIRAL_MIN_LIKES = 300;

// Max tweets accepted from one account per crawl (intake side; the display
// side additionally enforces X_AUTHOR_CAP in db-shared.ts arrangeFeed).
const MAX_PER_AUTHOR = 3;
// Keyword note: X search matches whole tokens — "ChatGPT" does NOT match
// "GPT" (a real viral pricing-comparison tweet slipped through on this),
// so common model/tool names are listed individually.
const VIRAL_QUERY =
  `(OpenAI OR Anthropic OR Claude OR ChatGPT OR GPT OR Gemini OR Grok OR ` +
  `LLM OR DeepSeek OR Qwen OR Llama OR Mistral OR Cursor OR Copilot OR ` +
  `"open weights" OR "AI agent" OR "AI coding" OR AGI) ` +
  // -"@grok" drops the huge "hey @grok do X" bot-summons meme class, which
  // otherwise dominates viral matches. Grok NEWS still matches on "Grok".
  `min_faves:${VIRAL_MIN_LIKES} -filter:replies -"@grok" lang:en`;
// The 24h sweep raises the bar so its match volume fits in a few pages —
// at VIRAL_MIN_LIKES a full day has hundreds of matches and pagination costs
// more than the slow-burners are worth. NOTE: X's search index lags live
// engagement (a ♥2.7K tweet indexed at ~1-1.5K), so the bar stays well below
// the "actually viral" level we're targeting. Independent of VIRAL_MIN_LIKES
// (page-budget tuning, not a buzz-tier bar) — do not lower this with it.
const SWEEP_MIN_LIKES = 1000;
const SWEEP_QUERY = VIRAL_QUERY.replace(
  `min_faves:${VIRAL_MIN_LIKES}`,
  `min_faves:${SWEEP_MIN_LIKES}`
);

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

async function search(key: string, query: string, pages = 1): Promise<XTweet[]> {
  const out: XTweet[] = [];
  let cursor = "";
  for (let page = 0; page < pages; page++) {
    const url =
      `https://api.twitterapi.io/twitter/tweet/advanced_search?queryType=Latest` +
      `&query=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetch(url, {
      headers: { "X-API-Key": key },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`twitterapi.io HTTP ${res.status}`);
    const data = (await res.json()) as { tweets?: XTweet[]; has_next_page?: boolean; next_cursor?: string };
    out.push(...(data.tweets ?? []));
    if (!data.has_next_page || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return out;
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
  const searches = [
    ...accountQueries(ORG_ACCOUNTS, "2h").map((q) => search(key, q)),
    ...accountQueries(PEOPLE_ACCOUNTS, PEOPLE_WINDOW).map((q) => search(key, q)),
    search(key, `${VIRAL_QUERY} within_time:6h`),
  ];
  // Slow-burn sweep: a tweet that crosses the viral bar 8+ hours after posting
  // never appears in the 6h window. 4×/day, sweep 24h at a higher bar with
  // pagination — results are Latest-ordered 20/page, so without extra pages an
  // older banger never surfaces. URL dedup absorbs the overlap.
  const now = new Date();
  if (now.getHours() % 6 === 0 && now.getMinutes() < 15) {
    searches.push(search(key, `${SWEEP_QUERY} within_time:24h`, 8));
  }
  const results = await Promise.all(searches);
  const orgs = new Set(ORG_ACCOUNTS.map((a) => a.toLowerCase()));
  const roster = new Set(
    [...ORG_ACCOUNTS, ...PEOPLE_ACCOUNTS].map((a) => a.toLowerCase())
  );
  const tweets = results.flat();
  const authorIntake: Record<string, number> = {};

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
    // Per-author intake cap: high-volume accounts (thread aggregators can
    // post 8+/day) would otherwise eat classification budget and dominate
    // the feed; keep each account's top posts by engagement instead.
    .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
    .filter((t) => {
      const user = (t.author?.userName ?? "").toLowerCase();
      authorIntake[user] = (authorIntake[user] ?? 0) + 1;
      return authorIntake[user] <= MAX_PER_AUTHOR;
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
