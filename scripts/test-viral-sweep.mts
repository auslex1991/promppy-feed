// Does the broadened 24h viral query return the example tweets we missed?
// (The examples are >24h old now, so query a matching window around them via
// since/until instead — same query semantics, just pinned to their timeframe.)
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}

const VIRAL_QUERY =
  `(OpenAI OR Anthropic OR Claude OR ChatGPT OR GPT OR Gemini OR Grok OR ` +
  `LLM OR DeepSeek OR Qwen OR Llama OR Mistral OR Cursor OR Copilot OR ` +
  `"open weights" OR "AI agent" OR "AI coding" OR AGI) ` +
  `min_faves:500 -filter:replies -"@grok" lang:en`;

// Mirror the production sweep: min_faves:2000, paginated 5 pages.
const query = `${VIRAL_QUERY.replace("min_faves:500", "min_faves:2000")} since:2026-07-12 until:2026-07-13`;
console.log(`query length: ${query.length} chars (limit ~512)`);

type Tweet = { id: string; likeCount?: number; text?: string; author?: { userName?: string } };
const tweets: Tweet[] = [];
let cursor = "";
for (let page = 0; page < 5; page++) {
  const res = await fetch(
    `https://api.twitterapi.io/twitter/tweet/advanced_search?queryType=Latest&query=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    { headers: { "X-API-Key": process.env.TWITTERAPI_KEY! }, signal: AbortSignal.timeout(20000) }
  );
  const data = (await res.json()) as { tweets?: Tweet[]; has_next_page?: boolean; next_cursor?: string };
  tweets.push(...(data.tweets ?? []));
  if (!data.has_next_page || !data.next_cursor) break;
  cursor = data.next_cursor;
}
console.log(`tweets returned: ${tweets.length}`);
const targets = ["2076107957277008100", "2076298361674911884"]; // chewadot, shub0414
for (const id of targets) {
  const hit = tweets.find((t) => t.id === id);
  console.log(`${hit ? "FOUND" : "not in first page"} ${id} ${hit ? `@${hit.author?.userName} ♥${hit.likeCount}` : ""}`);
}
for (const t of tweets.slice(0, 8)) {
  console.log(`  @${t.author?.userName} ♥${t.likeCount} ${(t.text ?? "").replace(/\s+/g, " ").slice(0, 90)}`);
}
