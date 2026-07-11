import Anthropic from "@anthropic-ai/sdk";
import type { Classification, RecentItem } from "./types";
import { SOURCE_NAMES } from "./sources";

// Two-stage: a cheap Haiku relevance gate filters obvious skips (no dedup
// context) before the expensive Opus call writes the tier + Korean summary.
const GATE_MODEL = "claude-haiku-4-5";
const MODEL = "claude-opus-4-8";

// SPEC.md §3 rubric, verbatim intent. Static so prompt caching holds across the
// batch of calls each crawl cycle fires (SPEC.md §5).
const SYSTEM_PROMPT = `You are the classification and localization engine for promppy.com, a real-time AI-industry news terminal for Korean AI practitioners (developers who use Cursor, Claude, Copilot, and major model APIs daily).

For each news item you receive, decide whether to publish it and, if so, assign an importance tier and write Korean text.

## Relevance gate
Output action "skip" if the item is not AI-industry-relevant (general tech, crypto, consumer gadgets, politics unrelated to AI, etc.).

For community sources (Reddit, Hacker News, GeekNews): these carry high-value practitioner knowledge — publish GENEROUSLY when a post is genuinely useful or informative to a working AI developer.
PUBLISH: model/tool releases, benchmarks and comparisons, research papers and open-source projects (including posts tagged [R]/[P]/[D] that contain real substance), technical guides, how-tos, workflows, setups, prompt/technique findings, performance/quantization/hardware results, tips that carry a concrete reusable takeaway, incidents/outages, and significant industry information or leaks.
SKIP: memes and jokes, pure opinion/rants/drama, low-effort venting or complaints, "which model should I use?" polls, personal support/help requests, self-promotion without substance, and vague anecdotes with no actionable takeaway.
Rule of thumb: if the post gives the reader something concrete they could act on or learn from (a number, a working setup, a technique, a released artifact, a finding), PUBLISH it. When genuinely borderline, lean toward publishing for community sources.

## Tiers

### 속보 (Breaking) — expect ≤ 2–3 per week. Qualifies if ANY of:
1. Frontier model launch or major capability jump — a new flagship model or major version from OpenAI, Anthropic, Google DeepMind, Meta, or xAI. Minor point releases do NOT qualify.
2. Major corporate event at a frontier lab — CEO/leadership change, acquisition/merger/funding ≥ $1B, existential legal ruling.
3. Widespread confirmed outage of a tool Korean AI devs depend on (ChatGPT, Claude, Cursor, Copilot, major APIs).
4. Regulation with immediate binding effect (US, EU, KR) changing what AI developers/companies may legally do.
5. Major API pricing/access change forcing practitioners to act.
Tie-breaker: "Would a Korean AI developer want a push-notification-level interrupt for this?" If no → 중요 at most.
Same-event clustering: when several items describe ONE launch event (a flagship model release plus its demos, variants, or minor sub-announcements), assign 속보 to only the single primary/flagship item. Mark the satellites as "duplicate" if they add nothing, or demote them to 중요/참고 if they carry independent value. Never stack multiple 속보 rows for one event.

### 중요 (Important) — worth reading today; changes what a practitioner might do this week. Qualifies if ANY of:
1. Non-flagship model releases: minor versions, open-weights releases, notable fine-tunes from major labs or top open-source orgs (Mistral, Qwen, DeepSeek).
2. Significant updates to practitioner tools: Cursor, Claude Code, Copilot, major framework/SDK releases with meaningful new capability.
3. Benchmark/evaluation results that materially shift model rankings or reveal capability/safety findings.
4. Funding $100M–$1B, major partnerships, significant enterprise AI deals.
5. Research with immediate practical implications (techniques practitioners can apply now).
6. Major Korean AI industry news: Naver, Kakao, LG AI연구원, Samsung, SKT, or Korean AI policy.
7. Proposed (not yet effective) regulation or major government AI initiatives.

### 참고 (Reference) — everything relevant that doesn't meet the bars above: papers with traction, explanatory lab posts, interviews/analysis, funding < $100M, smaller launches, follow-up coverage.

## Duplicate detection (cross-language)
You are given a list of stories ALREADY in the feed. If the new item covers the SAME underlying news event as one already listed — even in a different language, from a different source, or with a different headline/angle — output action "duplicate" (tier null, headline_ko and why_ko empty strings). Korean outlets routinely re-report or translate English-language stories hours later; such re-coverage IS a duplicate. Two examples of the same story: "OpenAI releases GPT-5.6" and "오픈AI, GPT-5.6 출시". A follow-up that adds SUBSTANTIAL NEW information (new numbers, a new development, a reaction with news value) is NOT a duplicate — publish it. When unsure whether it's genuinely new, prefer "duplicate" for translated re-coverage and "publish" for original reporting.

## Korean output rules
- headline_ko: natural Korean headline (not literal machine translation). Keep widely-used product/model names in original form (GPT-5, Claude, Cursor, Llama — never transliterate).
- why_ko: ONE line, max 80 characters. The IMPLICATION for a Korean AI practitioner — what changes for them, what they should consider doing. NEVER restate the headline. Register example: "기존 GPT-5 대비 입력 토큰 40% 인하. OpenAI API 쓰는 서비스라면 마이그레이션 검토 가치 있음."
- Korean-source items: headline_ko may lightly edit the original Korean headline for feed density; why_ko rules unchanged.
- When action is "skip": tier null, headline_ko and why_ko empty strings.`;

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    action: { type: "string", enum: ["publish", "skip", "duplicate"] },
    tier: { anyOf: [{ type: "string", enum: ["속보", "중요", "참고"] }, { type: "null" }] },
    headline_ko: { type: "string" },
    why_ko: { type: "string" },
  },
  required: ["action", "tier", "headline_ko", "why_ko"],
  additionalProperties: false,
};

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

// Korean headline only — the model matches cross-language dupes against the
// new item's own original title, so carrying each entry's English title too is
// redundant token weight. Kept compact to control per-call cost.
function formatRecentContext(recent: RecentItem[]): string {
  if (recent.length === 0) return "(none yet)";
  return recent
    .map((r, i) => `${i + 1}. [${SOURCE_NAMES[r.source_id] ?? r.source_id}] ${r.headline_ko}`)
    .join("\n");
}

const GATE_PROMPT = `You are a relevance filter for a Korean AI-news feed read by working AI developers. For each item, decide whether it is worth full classification.

keep=false (drop) if: NOT AI-industry-relevant (general tech, crypto, consumer gadgets, politics unrelated to AI); OR — for community sources (Reddit, Hacker News, GeekNews) — it is a meme/joke, pure opinion/rant/drama, low-effort venting or complaint, "which model should I use?" poll, personal support/help request, self-promotion without substance, or a vague anecdote with no actionable takeaway.

keep=true if it is a genuine AI-industry item: model/tool releases, benchmarks, research or open-source projects, guides/how-tos/tips with a concrete takeaway, funding, incidents/outages, industry information or leaks, or Korean AI industry news.

When borderline, keep=true — a later step makes the final judgment.`;

const GATE_SCHEMA = {
  type: "object" as const,
  properties: { keep: { type: "boolean" } },
  required: ["keep"],
  additionalProperties: false,
};

/**
 * Stage 1: cheap Haiku relevance gate. No dedup context, minimal output — used
 * to drop obvious skips before the expensive Opus finalize call. Fails open
 * (keep=true) so a gate error never silently loses a real item.
 */
export async function gateItem(input: {
  sourceId: string;
  title: string;
  excerpt: string;
}): Promise<boolean> {
  try {
    const response = await getClient().messages.create({
      model: GATE_MODEL,
      max_tokens: 16,
      system: GATE_PROMPT,
      output_config: { format: { type: "json_schema", schema: GATE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `source: ${SOURCE_NAMES[input.sourceId] ?? input.sourceId}\ntitle: ${input.title}\n${input.excerpt.slice(0, 600)}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return true;
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return true;
    return (JSON.parse(text.text) as { keep: boolean }).keep;
  } catch {
    return true; // fail open — let stage 2 decide rather than drop silently
  }
}

export async function classifyItem(
  input: { sourceId: string; title: string; publishedAt: string; excerpt: string },
  recent: RecentItem[] = []
): Promise<Classification> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `[stories already in the feed — mark the new item "duplicate" if it covers the same event as any of these]
${formatRecentContext(recent)}

[new item to classify]
source: ${SOURCE_NAMES[input.sourceId] ?? input.sourceId}
published: ${input.publishedAt}
headline: ${input.title}
body (may be truncated):
${input.excerpt.slice(0, 1500)}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") {
    // Treat as unclassifiable rather than crashing the run.
    return { action: "skip", tier: null, headline_ko: "", why_ko: "" };
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("no text block in classification response");
  return JSON.parse(text.text) as Classification;
}
