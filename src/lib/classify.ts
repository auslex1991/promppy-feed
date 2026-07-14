import Anthropic from "@anthropic-ai/sdk";
import type { Classification, RecentItem } from "./types";
import { SOURCE_NAMES } from "./sources";
import { geminiJson } from "./providers/gemini";

// Cost-optimized hybrid (active when GEMINI_API_KEY is set; falls back to the
// all-Claude path otherwise):
//   gate      → Gemini Flash-Lite  (cheap keep/drop, no dedup context)
//   classify  → Gemini Flash       (tier + dedup + Korean draft)
//   polish    → Claude Opus        (rewrites headline/why for 속보/중요 only —
//                                   the rows readers actually scan)
//   briefing  → Claude Opus        (1 call/day)
const GATE_MODEL = "claude-haiku-4-5";
const MODEL = "claude-opus-4-8";
const GEMINI_GATE_MODEL = "gemini-3.1-flash-lite";
// flash-lite ($0.25/$1.50 per M) A/B'd against 3.5-flash ($1.50/$9) on real
// items 2026-07-13: tiers consistent, headlines natural — 6× cheaper. Opus
// polish still rewrites everything 속보/중요, so lite only carries 참고 lines.
const GEMINI_CLASSIFY_MODEL = "gemini-3.1-flash-lite";
const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

// SPEC.md §3 rubric, verbatim intent. Static so prompt caching holds across the
// batch of calls each crawl cycle fires (SPEC.md §5).
const SYSTEM_PROMPT = `You are the classification and localization engine for promppy.com, a real-time AI-industry news terminal for Korean AI practitioners (developers who use Cursor, Claude, Copilot, and major model APIs daily).

For each news item you receive, decide whether to publish it and, if so, assign an importance tier and write Korean text.

## Relevance gate
Output action "skip" if the item is not AI-industry-relevant (general tech, crypto, consumer gadgets, politics unrelated to AI, etc.).

X posts (source "X"): the excerpt shows the like count (좋아요 N). A VIRAL post (좋아요 ≥ 300) from an AI-industry figure is publishable as community buzz even when casual — publish as 참고 with a headline framing it as 화제 (e.g. "sama, '...' 발언 화제"), and a why_ko explaining what the buzz signals. Escalate to 중요 only when the viral post carries real industry substance (product hints, org changes, notable claims). VIRAL DOES NOT EXCUSE OFF-TOPIC: political or culture-war drama, personal feuds, crypto/giveaway/engagement bait, and posts that merely mention an AI product while being about something else are skip at ANY like count — the buzz must be ABOUT the AI industry itself.
X TIPS: an X post with a CONCRETE, REPRODUCIBLE practitioner takeaway (a workflow, prompt technique, tool configuration, debugging insight, benchmark number, working setup) is publishable REGARDLESS of like count — judge it by the community-source standard below, not by engagement. Vague advice ("write better prompts", "just use agents") is NOT a tip — it must name something specific the reader can act on today. All other non-viral X chatter: skip.

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
When in doubt between 중요 and 참고, choose 참고 — 중요 requires a CLEAR practitioner impact this week, not merely an interesting item.

### 참고 (Reference) — everything relevant that doesn't meet the bars above: papers with traction, explanatory lab posts, interviews/analysis, funding < $100M, smaller launches, follow-up coverage.

## Duplicate detection (cross-language)
You are given a list of stories ALREADY in the feed, each with a numeric id. If the new item covers the SAME underlying news event as one already listed — even in a different language, from a different source, or with a different headline/angle — output action "duplicate" with duplicate_of set to that story's id (tier null, headline_ko and why_ko empty strings). For any other action, duplicate_of is null. Korean outlets routinely re-report or translate English-language stories hours later; such re-coverage IS a duplicate. Two examples of the same story: "OpenAI releases GPT-5.6" and "오픈AI, GPT-5.6 출시". A follow-up that adds SUBSTANTIAL NEW information (new numbers, a new development, a reaction with news value) is NOT a duplicate — publish it. When unsure whether it's genuinely new, prefer "duplicate" for translated re-coverage and "publish" for original reporting.

## is_tip flag
Set is_tip=true when the published item's core value is a practical, reusable technique the reader can apply — a workflow, prompt pattern, tool setup, optimization, debugging method, or how-to with concrete specifics. News about products, companies, research announcements, funding, or industry events is is_tip=false even when useful. When action is not "publish", is_tip=false.

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
    duplicate_of: { anyOf: [{ type: "integer" }, { type: "null" }] },
    is_tip: { type: "boolean" },
  },
  required: ["action", "tier", "headline_ko", "why_ko", "duplicate_of", "is_tip"],
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
    .map((r) => `id ${r.id} [${SOURCE_NAMES[r.source_id] ?? r.source_id}] ${r.headline_ko}`)
    .join("\n");
}

const GATE_PROMPT = `You are a relevance filter for a Korean AI-news feed read by working AI developers. For each item, decide whether it is worth full classification.

keep=false (drop) if: NOT AI-industry-relevant (general tech, crypto, consumer gadgets, politics unrelated to AI); OR — for community sources (Reddit, Hacker News, GeekNews) — it is a meme/joke, pure opinion/rant/drama, low-effort venting or complaint, "which model should I use?" poll, personal support/help request, self-promotion without substance, or a vague anecdote with no actionable takeaway.

keep=true if it is a genuine AI-industry item: model/tool releases, benchmarks, research or open-source projects, guides/how-tos/tips with a concrete takeaway, funding, incidents/outages, industry information or leaks, or Korean AI industry news.

X posts (source "X"): the excerpt shows the like count (좋아요 N). keep=true when the post is AI-relevant, OR when it is VIRAL (좋아요 ≥ 300) — a viral post from an AI-industry figure is newsworthy community buzz even if the content is casual. keep=true ALSO for any X post with a concrete practitioner takeaway (a workflow, prompt technique, tool config, debugging insight, benchmark number) regardless of like count — treat it like a Reddit tip. Non-viral X chatter with no takeaway: keep=false. VIRAL DOES NOT EXCUSE OFF-TOPIC: political or culture-war drama, personal feuds, crypto/giveaway/engagement bait, and posts that merely mention an AI product while being about something else are keep=false at ANY like count.

When borderline, keep=true — a later step makes the final judgment.`;

const GATE_SCHEMA = {
  type: "object" as const,
  properties: { keep: { type: "boolean" } },
  required: ["keep"],
  additionalProperties: false,
};

/**
 * Stage 1: cheap relevance gate (Gemini Flash-Lite when configured, else
 * Haiku). No dedup context, minimal output — drops obvious skips before the
 * expensive classify call. Fails open (keep=true) so a gate error never
 * silently loses a real item.
 */
export async function gateItem(input: {
  sourceId: string;
  title: string;
  excerpt: string;
}): Promise<boolean> {
  const user = `source: ${SOURCE_NAMES[input.sourceId] ?? input.sourceId}\ntitle: ${input.title}\n${input.excerpt.slice(0, 600)}`;
  if (geminiEnabled()) {
    try {
      const out = await geminiJson<{ keep: boolean }>(
        GEMINI_GATE_MODEL,
        GATE_PROMPT,
        user,
        { type: "OBJECT", properties: { keep: { type: "BOOLEAN" } }, required: ["keep"] },
        256,
        100,
        // Fail-open semantics make retries pointless here — keep the gate fast
        // so a Gemini incident can't eat the crawl's wall-clock budget.
        { timeoutMs: 12000, attempts: 1 }
      );
      return out.keep;
    } catch {
      return true; // fail open
    }
  }
  try {
    const response = await getClient().messages.create({
      model: GATE_MODEL,
      max_tokens: 16,
      system: GATE_PROMPT,
      output_config: { format: { type: "json_schema", schema: GATE_SCHEMA } },
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") return true;
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return true;
    return (JSON.parse(text.text) as { keep: boolean }).keep;
  } catch {
    return true; // fail open — let stage 2 decide rather than drop silently
  }
}

const GEMINI_CLASSIFY_SCHEMA = {
  type: "OBJECT",
  properties: {
    action: { type: "STRING", enum: ["publish", "skip", "duplicate"] },
    tier: { type: "STRING", enum: ["속보", "중요", "참고"], nullable: true },
    headline_ko: { type: "STRING" },
    why_ko: { type: "STRING" },
    duplicate_of: { type: "INTEGER", nullable: true },
    is_tip: { type: "BOOLEAN" },
  },
  required: ["action", "headline_ko", "why_ko"],
};

const POLISH_PROMPT = `당신은 promppy(한국 AI 실무자를 위한 실시간 AI 뉴스 터미널)의 최종 데스크입니다. 초안 헤드라인과 시사점을 최고 품질의 한국어로 다듬어 완성하세요.

규칙:
- headline_ko: 자연스러운 한국어 헤드라인 (기계 번역투 금지). 널리 쓰이는 제품·모델명은 원문 유지 (GPT-5, Claude, Cursor, Llama — 음차 금지).
- why_ko: 정확히 한 줄, 최대 80자. 한국 AI 실무자에게의 '시사점' — 무엇이 달라지고 무엇을 검토해야 하는지. 헤드라인 재진술 절대 금지. 예시 톤: "기존 GPT-5 대비 입력 토큰 40% 인하. OpenAI API 쓰는 서비스라면 마이그레이션 검토 가치 있음."
- 초안이 이미 훌륭하면 최소 수정만 하세요.`;

const POLISH_SCHEMA = {
  type: "object" as const,
  properties: { headline_ko: { type: "string" }, why_ko: { type: "string" } },
  required: ["headline_ko", "why_ko"],
  additionalProperties: false,
};

/** Opus rewrite of the visible Korean lines — only for 속보/중요 items. */
async function polishItem(
  input: { sourceId: string; title: string; excerpt: string },
  draft: { headline_ko: string; why_ko: string; tier: string }
): Promise<{ headline_ko: string; why_ko: string }> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 512,
    system: [{ type: "text", text: POLISH_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: POLISH_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `출처: ${SOURCE_NAMES[input.sourceId] ?? input.sourceId}
등급: ${draft.tier}
원문 제목: ${input.title}
본문 일부: ${input.excerpt.slice(0, 800)}

[초안]
headline_ko: ${draft.headline_ko}
why_ko: ${draft.why_ko}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") return draft;
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return draft;
  return JSON.parse(text.text) as { headline_ko: string; why_ko: string };
}

export async function classifyItem(
  input: { sourceId: string; title: string; publishedAt: string; excerpt: string },
  recent: RecentItem[] = []
): Promise<Classification> {
  const userContent = `[stories already in the feed — mark the new item "duplicate" if it covers the same event as any of these]
${formatRecentContext(recent)}

[new item to classify]
source: ${SOURCE_NAMES[input.sourceId] ?? input.sourceId}
published: ${input.publishedAt}
headline: ${input.title}
body (may be truncated):
${input.excerpt.slice(0, 1500)}`;

  if (geminiEnabled()) {
    try {
      // Gemini drafts everything; Opus polishes only the high-visibility tiers.
      const draft = await geminiJson<Classification>(
        GEMINI_CLASSIFY_MODEL,
        SYSTEM_PROMPT,
        userContent,
        GEMINI_CLASSIFY_SCHEMA,
        1024
      );
      const result: Classification = {
        action: draft.action ?? "skip",
        tier: draft.tier ?? null,
        headline_ko: draft.headline_ko ?? "",
        why_ko: draft.why_ko ?? "",
        duplicate_of: draft.duplicate_of ?? null,
        is_tip: draft.is_tip ?? false,
      };
      if (result.action === "publish" && (result.tier === "속보" || result.tier === "중요")) {
        try {
          const polished = await polishItem(input, {
            headline_ko: result.headline_ko,
            why_ko: result.why_ko,
            tier: result.tier,
          });
          result.headline_ko = polished.headline_ko || result.headline_ko;
          result.why_ko = polished.why_ko || result.why_ko;
        } catch {
          // keep the Gemini draft — a missed polish is not worth losing the item
        }
      }
      return result;
    } catch (e) {
      // Gemini outage (503 storms, timeouts after retries) → fall through to
      // the all-Claude path so a provider incident never stalls the feed.
      console.error("gemini classify failed, falling back to claude:", e instanceof Error ? e.message : e);
    }
  }

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });
  if (response.stop_reason === "refusal") {
    // Treat as unclassifiable rather than crashing the run.
    return { action: "skip", tier: null, headline_ko: "", why_ko: "", duplicate_of: null };
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("no text block in classification response");
  return JSON.parse(text.text) as Classification;
}

export interface BatchItem {
  id: number;
  sourceId: string;
  title: string;
  publishedAt: string;
  excerpt: string;
}

const GEMINI_BATCH_SCHEMA = {
  type: "OBJECT",
  properties: {
    results: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "INTEGER" },
          action: { type: "STRING", enum: ["publish", "skip", "duplicate"] },
          tier: { type: "STRING", enum: ["속보", "중요", "참고"], nullable: true },
          headline_ko: { type: "STRING" },
          why_ko: { type: "STRING" },
          duplicate_of: { type: "INTEGER", nullable: true },
          is_tip: { type: "BOOLEAN" },
        },
        required: ["id", "action", "headline_ko", "why_ko"],
      },
    },
  },
  required: ["results"],
};

/**
 * Batched classification: one Gemini call for up to ~8 items, so the fixed
 * overhead (rubric + dedup context, ~4K tokens) is paid once per batch
 * instead of once per item. The model also sees same-batch items together,
 * which makes same-crawl dedup direct instead of incremental. Opus polish is
 * applied per-item to 속보/중요 results, same as the single-item path.
 * Throws on batch failure — the caller falls back to per-item classifyItem.
 */
export async function classifyGeminiBatch(
  items: BatchItem[],
  recent: RecentItem[]
): Promise<Map<number, Classification>> {
  const itemBlocks = items
    .map(
      (p) => `[item id=${p.id}]
source: ${SOURCE_NAMES[p.sourceId] ?? p.sourceId}
published: ${p.publishedAt}
headline: ${p.title}
body (may be truncated):
${p.excerpt.slice(0, 1500)}`
    )
    .join("\n\n");
  const userContent = `[stories already in the feed — mark a new item "duplicate" if it covers the same event as any of these]
${formatRecentContext(recent)}

[new items to classify — return one result per item id, in order. Items later in this batch may duplicate EARLIER ITEMS IN THIS BATCH: if so, mark them duplicate with duplicate_of set to that earlier item's id.]

${itemBlocks}`;

  const out = await geminiJson<{ results: Array<Classification & { id: number }> }>(
    GEMINI_CLASSIFY_MODEL,
    SYSTEM_PROMPT,
    userContent,
    GEMINI_BATCH_SCHEMA,
    4096,
    400,
    // One big call per batch — worth a generous per-attempt timeout, but only
    // 2 attempts so a Gemini incident degrades to the per-item fallback fast.
    { timeoutMs: 75000, attempts: 2 }
  );

  const map = new Map<number, Classification>();
  for (const r of out.results ?? []) {
    if (!items.some((p) => p.id === r.id)) continue; // hallucinated id — drop
    map.set(r.id, {
      action: r.action ?? "skip",
      tier: r.tier ?? null,
      headline_ko: r.headline_ko ?? "",
      why_ko: r.why_ko ?? "",
      duplicate_of: r.duplicate_of ?? null,
      is_tip: r.is_tip ?? false,
    });
  }

  // Opus polish for the high-visibility tiers, per item.
  for (const p of items) {
    const r = map.get(p.id);
    if (!r || r.action !== "publish" || (r.tier !== "속보" && r.tier !== "중요")) continue;
    try {
      const polished = await polishItem(
        { sourceId: p.sourceId, title: p.title, excerpt: p.excerpt },
        { headline_ko: r.headline_ko, why_ko: r.why_ko, tier: r.tier }
      );
      r.headline_ko = polished.headline_ko || r.headline_ko;
      r.why_ko = polished.why_ko || r.why_ko;
    } catch {
      // keep the draft
    }
  }
  return map;
}

/**
 * Korean article summary for the item page (4–6 sentences). Gemini Flash —
 * runs once per published item. Returns "" on failure; callers treat that as
 * "no summary" rather than an error.
 */
export async function summarizeArticle(input: {
  sourceId: string;
  title: string;
  text: string;
}): Promise<string> {
  if (!geminiEnabled() || input.text.trim().length < 200) return "";
  try {
    const out = await geminiJson<{ summary_ko: string }>(
      GEMINI_CLASSIFY_MODEL,
      `당신은 promppy(한국 AI 실무자를 위한 뉴스 서비스)의 요약 작성자입니다. 제공된 기사/글을 한국어 4~6문장으로 요약하세요.
규칙: 사실 위주, 구체적 수치·제품명·날짜 유지(제품·모델명은 원문 표기), 기사에 없는 내용 추가 금지, 서두("이 기사는...") 없이 바로 내용부터, 실무자가 알아야 할 핵심 순서로.`,
      `출처: ${SOURCE_NAMES[input.sourceId] ?? input.sourceId}\n제목: ${input.title}\n본문:\n${input.text.slice(0, 4000)}`,
      { type: "OBJECT", properties: { summary_ko: { type: "STRING" } }, required: ["summary_ko"] },
      1024,
      200,
      { timeoutMs: 25000, attempts: 1 } // optional enrichment — never worth stalling the crawl
    );
    return (out.summary_ko ?? "").trim();
  } catch (e) {
    console.error("summarizeArticle failed:", e instanceof Error ? e.message : e);
    return "";
  }
}

/**
 * 오늘의 브리핑: one call per day condensing the last 24h's top items into a
 * 4–6 line morning digest, pinned above the feed.
 */
export async function generateBriefing(
  items: Array<{ headline_ko: string; why_ko: string; tier: string }>
): Promise<string> {
  const list = items
    .map((i) => `[${i.tier}] ${i.headline_ko} — ${i.why_ko}`)
    .join("\n");
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 700,
    system:
      "당신은 promppy의 아침 브리핑 작성자입니다. 제공된 최근 24시간 AI 뉴스 목록에서 한국 AI 실무자에게 가장 중요한 것들을 골라, 4~6개의 짧은 불릿(각 줄 '• '로 시작, 한 줄 60자 이내)으로 요약하세요. 서두·맺음말 없이 불릿만 출력합니다. 겹치는 소식은 묶고, 구체적 수치·제품명은 유지하세요.",
    messages: [{ role: "user", content: list }],
  });
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("no text in briefing response");
  return text.text.trim();
}
