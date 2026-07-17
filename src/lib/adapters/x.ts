import type { RawItem } from "../types";
import { getXAccounts, seedXAccounts, lastSuccessfulRun } from "../db";

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
// SEED lists: the initial roster written into the x_accounts table on first
// run, and the fallback if the DB is ever unreadable (so a DB hiccup never
// disables X entirely). The LIVE roster is the DB — edit it via /admin, not
// here. Org accounts post announcements (every non-reply passes to the gate);
// people accounts mix signal with chatter (only real-engagement tweets enter).
const SEED_ORG_ACCOUNTS = [
  "OpenAI", "AnthropicAI", "GoogleDeepMind", "xai", "AIatMeta", "MistralAI",
  "huggingface", "cursor_ai",
  "GoogleAI", "perplexity_ai", "deepseek_ai", "Alibaba_Qwen", "nvidia",
  "LangChainAI", "llama_index", "GroqInc", "Replit", "elevenlabsio",
  "runwayml", "v0",
];
const SEED_PEOPLE_ACCOUNTS = [
  "sama", "karpathy", "ylecun", "demishassabis", "DrJimFan", "_akhaliq",
  "swyx", "OfficialLoganK", "alexalbert__", "AndrewYNg",
  "emollick", "rowancheung", "mckaywrigley", "goodside", "jeremyphoward",
  "hwchase17", "bindureddy", "minchoi", "levelsio", "LinusEkenstam",
  "gdb", "simonw", "aidan_mclau", "nearcyan",
  "charliejhills", "MyWestLord", "ahmedrann", "0xJeff", "AnatoliKopadze",
  "ai_explorer25", "undefinedKi", "humzaakhalid", "cyrilXBT", "Star_Knight12",
  "CodeswithClara",
  "AlexFinn", "petergostev", "theo", "Ciri_ai", "hqmank", "DavidOndrej1",
  "_avichawla", "DataChaz", "ns123abc", "alexcooldev",
];

export interface XRoster {
  org: string[];
  people: string[];
}

/**
 * The live X roster from the DB. Seeds the table from SEED_* on first run,
 * and falls back to the seed lists if the DB is unreadable — X must never
 * silently go empty. Handles are stored lowercase (X search is
 * case-insensitive); the /admin page reads and writes through the same table.
 */
export async function loadXRoster(): Promise<XRoster> {
  try {
    let rows = await getXAccounts();
    if (rows.length === 0) {
      await seedXAccounts([
        ...SEED_ORG_ACCOUNTS.map((h) => ({ handle: h.toLowerCase(), kind: "org" })),
        ...SEED_PEOPLE_ACCOUNTS.map((h) => ({ handle: h.toLowerCase(), kind: "people" })),
      ]);
      rows = await getXAccounts();
    }
    return {
      org: rows.filter((r) => r.kind === "org").map((r) => r.handle),
      people: rows.filter((r) => r.kind === "people").map((r) => r.handle),
    };
  } catch {
    return { org: SEED_ORG_ACCOUNTS, people: SEED_PEOPLE_ACCOUNTS };
  }
}

// No like bar for roster accounts. We now fetch each roster tweet within
// minutes of posting (see sinceTime below), when even a great post has 0-2
// likes — any threshold would just drop good posts for being new. Substance
// is the gate's job; anything that blows up later is still caught by the
// viral/sweep passes.
const MIN_LIKES_PEOPLE = 0;

// Roster fetches ask only for tweets newer than the previous crawl, instead of
// re-requesting a fixed window every run. twitterapi.io bills per tweet
// RETURNED and our URL-dedup happens only after we've already paid, so a 12h
// window on a 15-min cadence meant paying for the same tweets up to 48×.
// (It was also silently lossy: every chunk hit the 20-tweet page cap with
// "more pages available", so tweets beyond the newest 20 were never seen at
// all — a narrow window is both cheaper AND more complete.)
const SINCE_BUFFER_MS = 5 * 60_000; // clock skew / crawl overlap
const MAX_LOOKBACK_MS = 12 * 3600_000; // cap the catch-up bill after an outage

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
  replyCount?: number;
  isReply?: boolean;
  conversationId?: string;
  author?: { userName?: string };
}

// Longform single tweets run to ~1-4K chars; capture the whole thing (the old
// 900 cap lopped substance off the exact posts worth reading). DB storage cap
// is raised to match. Classification still slices to 1500 (tier/headline need
// no more); the Korean summary reads the full stored excerpt.
const X_EXCERPT_CAP = 2500;

// Only spend a thread_context call when the text explicitly signals a
// multi-tweet thread AND there are replies to chain — most "threads" among AI
// accounts are actually one longform tweet (author chain of 1), so an
// unconditional fetch would pay per item for nothing.
const THREAD_MARKER = /🧵|(^|\s)1\/|(^|\s)a thread(\s|$|:|\.)/i;

/**
 * For a genuine self-reply thread, concatenate the author's own chain
 * (chronological) so the classifier and summary see the whole argument, not
 * just the hook. Fails open to the root text on any error — thread enrichment
 * is a bonus, never a reason to drop an item.
 */
async function fetchThreadText(key: string, opener: XTweet): Promise<string> {
  const author = opener.author?.userName?.toLowerCase();
  if (!author) return opener.text ?? "";
  try {
    const res = await fetch(
      `https://api.twitterapi.io/twitter/tweet/thread_context?tweetId=${opener.id}`,
      { headers: { "X-API-Key": key }, signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return opener.text ?? "";
    const data = (await res.json()) as { tweets?: XTweet[] };
    const chain = (data.tweets ?? [])
      .filter((t) => t.author?.userName?.toLowerCase() === author && !t.text?.startsWith("RT @"))
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
    if (chain.length <= 1) return opener.text ?? "";
    // Drop the leading "@handle" reply prefixes from continuation tweets.
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const t of chain) {
      const clean = (t.text ?? "").replace(/^(@\w+\s+)+/, "").trim();
      if (clean && !seen.has(t.id)) {
        seen.add(t.id);
        parts.push(clean);
      }
    }
    return parts.join(" ");
  } catch {
    return opener.text ?? "";
  }
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

function accountQueries(accounts: string[], sinceTime: number): string[] {
  const chunks: string[][] = [];
  for (let i = 0; i < accounts.length; i += CHUNK_SIZE) chunks.push(accounts.slice(i, i + CHUNK_SIZE));
  return chunks.map((c) => `(${c.map((a) => `from:${a}`).join(" OR ")}) since_time:${sinceTime}`);
}

/** Unix seconds to fetch roster tweets from: just after the previous crawl. */
async function rosterSinceTime(): Promise<number> {
  let lastMs = 0;
  try {
    const last = await lastSuccessfulRun();
    if (last?.finished_at) lastMs = new Date(last.finished_at).getTime();
  } catch {
    // fall through to the max-lookback floor
  }
  const floor = Date.now() - MAX_LOOKBACK_MS;
  return Math.floor(Math.max(lastMs - SINCE_BUFFER_MS, floor) / 1000);
}

export async function fetchX(sourceId: string, maxItems = 50): Promise<RawItem[]> {
  const key = process.env.TWITTERAPI_KEY;
  if (!key) return [];

  const [{ org: ORG_ACCOUNTS, people: PEOPLE_ACCOUNTS }, sinceTime] = await Promise.all([
    loadXRoster(),
    rosterSinceTime(),
  ]);

  // Roster passes fetch only what's new since the last crawl. The viral pass
  // still needs a rolling window: it catches tweets that cross the like bar
  // hours after posting, which since_time would exclude by created_at.
  const searches = [
    ...accountQueries(ORG_ACCOUNTS, sinceTime).map((q) => search(key, q)),
    ...accountQueries(PEOPLE_ACCOUNTS, sinceTime).map((q) => search(key, q)),
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

  const kept = tweets
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
    .slice(0, maxItems);

  return Promise.all(
    kept.map(async (t) => {
      const user = t.author?.userName ?? "unknown";
      // Enrich only true thread openers; everyone else uses the (now full) text.
      const raw =
        THREAD_MARKER.test(t.text ?? "") && (t.replyCount ?? 0) >= 2
          ? await fetchThreadText(key, t)
          : t.text ?? "";
      const text = raw.replace(/\s+/g, " ").trim();
      return {
        sourceId,
        url: t.url,
        title: `@${user}: ${text.slice(0, 130)}`,
        publishedAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
        excerpt: `Post by @${user} on X (좋아요 ${t.likeCount ?? 0}). ${text}`.slice(0, X_EXCERPT_CAP),
      };
    })
  );
}
