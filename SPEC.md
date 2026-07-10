# SPEC — promppy.com 실시간 AI 뉴스 피드

**Version:** v1 draft (2026-07-10)
**Status:** Pre-implementation product definition
**Companion doc:** [SOURCES.md](SOURCES.md)

---

## 1. Core Concept

A real-time feed of AI industry news that becomes the promppy.com homepage. Modeled on byul.ai's real-time economic news alert format, but for AI news, targeting **Korean AI practitioners** — developers who use Cursor, Claude, Copilot, and the major model APIs daily.

The product is not a news aggregator with thumbnails and articles. It is a **terminal**: a dense, fast, always-current stream of items, each answering one question for the reader in one line — *"이게 나한테 왜 중요한가?"*

Every feed item consists of:

| Field | Description |
|---|---|
| **Timestamp** | Publication time in KST, monospace (`14:32:07`), with relative display (`3분 전`) |
| **Tier badge** | 속보 / 중요 / 참고 — color-coded (see §3) |
| **Headline (KO)** | Korean headline. LLM-translated from the source headline; natural Korean, not literal machine translation |
| **Why it matters (KO)** | One line, ≤ 80 chars. The *implication* for a Korean AI practitioner — not a translation or restatement of the headline |
| **Source** | Source name + link to original |

The "why it matters" line is the product's core differentiation. Examples of the intended register:

> **OpenAI, GPT-5.5 API 출시** — *기존 GPT-5 대비 입력 토큰 40% 인하. OpenAI API 쓰는 서비스라면 당장 마이그레이션 검토 가치 있음.*

> **Cursor 1.8 릴리스** — *멀티 에이전트 병렬 실행 지원. 대형 리팩토링 워크플로우가 달라질 수 있는 업데이트.*

Bad (what we must NOT produce): "OpenAI가 새 모델을 출시했다" — that's the headline again, not an implication.

## 2. Language & Localization Policy

- **Everything displayed in Korean.** Headlines are translated to Korean by the LLM pipeline; the "why" summary is written directly in Korean.
- **The original headline and URL are always preserved** in the data model and accessible in the UI (expand/detail view links to the source; original headline shown on expand). Widely-used product/model names stay in their original form inside Korean text (GPT-5, Claude, Cursor, Llama — do not transliterate).
- Timestamps are KST (Asia/Seoul).

## 3. Importance Tiers

Three tiers, assigned automatically by the LLM pipeline (§5) against the criteria below. The criteria are the classification rubric — they are written to be usable verbatim in the classifier prompt.

### 속보 (Breaking) — red

The reader would want to be interrupted for this. Expected volume: **≤ 2–3 per week**. Qualifies if ANY of:

1. **Frontier model launch or major capability jump** — a new flagship model or major version from OpenAI, Anthropic, Google DeepMind, Meta, or xAI (e.g. a GPT/Claude/Gemini major release). Minor point releases do not qualify.
2. **Major corporate event at a frontier lab** — CEO/leadership departure or appointment, acquisition, merger, or funding/valuation event ≥ $1B, existential legal ruling.
3. **Widespread outage of a tool Korean AI devs depend on** — ChatGPT, Claude, Cursor, Copilot, OpenAI/Anthropic API down (confirmed, not a blip).
4. **Regulation with immediate binding effect** — a law, executive order, or court decision (US, EU, or KR) that changes what AI developers/companies may legally do, effective now or imminently.
5. **Major API pricing or access change** — a pricing change, deprecation, or access restriction on a major model API that forces practitioners to act.

Tie-breaker question for the classifier: *"Would a Korean AI developer want a push-notification-level interrupt for this?"* If no, it is 중요 at most.

### 중요 (Important) — amber

Worth reading today; changes what a practitioner might do this week. Expected volume: **5–15 per day**. Qualifies if ANY of:

1. Non-flagship model releases: minor versions, open-weights releases, notable fine-tunes from major labs or top open-source orgs (Mistral, Qwen, DeepSeek).
2. Significant updates to practitioner tools: Cursor, Claude Code, Copilot, major framework/SDK releases (LangChain, vLLM, etc.) with meaningful new capability.
3. Benchmark or evaluation results that materially shift model rankings or reveal capability/safety findings.
4. Funding rounds $100M–$1B, major partnerships, significant enterprise deals in the AI industry.
5. Research with immediate practical implications (a technique practitioners can apply now — not incremental benchmark papers).
6. Major Korean AI industry news: Naver, Kakao, LG AI연구원, Samsung, SKT AI announcements, or Korean AI policy developments.
7. Proposed (not yet effective) regulation or major government AI initiatives.

### 참고 (Reference) — gray

Ambient awareness; skimmable. Everything that passes the relevance filter but doesn't meet the bars above. Expected volume: **20–40 per day**. Typical members:

1. arXiv papers with external traction (see SOURCES.md — papers enter only via Hacker News front page or Hugging Face Daily Papers).
2. Lab blog posts that are explanatory/technical rather than announcements.
3. Interviews, opinion pieces, industry analysis from tier-1 media.
4. Funding < $100M, smaller product launches, community projects with traction.
5. Follow-up/derivative coverage of a story already in the feed (deduped where possible; see §5).

### Relevance filter (implicit tier 0: skip)

The classifier may also output **skip** for items that are not AI-industry-relevant (general tech news from mixed feeds, crypto, consumer gadget reviews, etc.). Skipped items are stored with their skip status for auditability but never displayed.

## 4. Update Promise

- **Crawler runs every 15 minutes**, on a fixed schedule, across the ~19 sources in SOURCES.md.
- Target end-to-end latency: an item appears in the feed **within 20 minutes** of source publication (15-min crawl interval + processing).
- **Deduplication:** canonical-URL + normalized-title hash prevents re-ingesting the same item. When multiple sources cover the same story within a window (e.g. TechCrunch and The Verge on the same OpenAI announcement), the earliest/most-primary item is kept (official lab source > tier-1 media > aggregator) and later duplicates are dropped or demoted to 참고.
- The frontend reflects new items **without a manual refresh** (client polling every 30–60s in v1; SSE/WebSocket is a later upgrade).
- A visible **"LIVE" indicator with last-crawl timestamp** communicates the freshness promise on the page itself. If the crawler has not succeeded for > 45 minutes, the indicator degrades visibly (e.g. pulsing dot turns static amber) rather than silently lying.

## 5. Content Pipeline

Fully automated; no human in the loop for v1.

```
every 15 min (cron)
  → fetch all sources (RSS parse / HTML scrape / API — per SOURCES.md)
  → normalize (canonical URL, title, published_at, source, raw excerpt)
  → dedup against DB (URL + title hash; cross-source story matching)
  → for each new item: Claude API call →
      { skip | tier, headline_ko, why_ko }
  → insert into DB
  → feed reflects new rows on next poll
```

**LLM call design:**

- Claude API (Messages API), model **`claude-opus-4-8`** (current default recommendation). `claude-haiku-4-5` ($1/$5 per MTok) is the designated cost-reduction lever if volume makes Opus pricing uncomfortable — a deliberate quality-for-cost trade to be decided after observing real volume, not a default.
- **Structured outputs** (`output_config.format` with a strict JSON schema): `{ "action": "publish" | "skip", "tier": "속보" | "중요" | "참고" | null, "headline_ko": string, "why_ko": string }` — guarantees parseable output, no regex extraction.
- The system prompt contains the §3 rubric verbatim plus the "why it matters" register guidance (implications for Korean practitioners, ≤ 80 chars, no headline restatement) — **prompt-cached** (`cache_control: ephemeral`) since it is identical across all calls and the crawler fires batches of calls every 15 minutes, well within the cache TTL.
- Input per item: source name, original headline, published time, and the first ~1,500 chars of the article/post body (enough context to judge implications; full articles are not needed).
- Volume estimate: ~50–100 new items/day → trivially within rate limits; per-item calls (not the Batch API — batch turnaround up to 1h would break the 20-minute latency promise).

## 6. Design Language

**Dark terminal / trading-desk aesthetic. The page should feel alive.**

- **Dark theme only** in v1. Near-black background (`#0a0e14` territory), high-contrast text. No light mode.
- **Monospace timestamps** and numeric elements (JetBrains Mono / IBM Plex Mono); Korean body text in Pretendard or similar.
- **Severity color coding**, applied to the tier badge and a thin row accent:
  - 속보 — red (`#ff4d4f` range), highest visual weight, may pulse briefly on arrival
  - 중요 — amber (`#ffb020` range)
  - 참고 — muted gray (`#8b949e` range), lowest weight
- **Dense, row-based layout** — one item per row like a terminal blotter: `[time] [badge] [headline] [source]`, with the why-line beneath the headline. No thumbnails in rows. Click/tap expands to show the original headline + link.
- **Feels alive:** pulsing LIVE dot with last-update time; new items animate in at the top (brief highlight flash, then settle); relative timestamps tick ("방금", "3분 전" → absolute time on hover). Motion is subtle and functional — no gratuitous animation.
- Responsive: the row layout collapses gracefully on mobile (time + badge on one line, headline below); a large share of Korean news consumption is mobile.

## 7. Architecture (brief)

Named here so the code that follows has a target; details are implementation's job.

- **Next.js (App Router) on Vercel** — this becomes the promppy.com homepage.
- **Vercel Cron** (`*/15 * * * *`) triggering a route handler that runs the §5 pipeline. If the full crawl risks exceeding function limits, split into a fetch step and a classify step, or move the crawler to a small worker later.
- **Postgres** (Neon or Supabase) — single `items` table carries the product; plus a `crawl_runs` table for the freshness indicator and debugging.
- **Claude API** for classification + translation + summary (see §5).
- **Feed delivery:** server-rendered first page + client polling (30–60s) for updates. SSE later if polling feels insufficient.

## 8. Out of Scope for v1

Explicitly not building:

- ❌ **Auth / accounts** — the feed is fully public.
- ❌ **Premium tier / payments** — no paywall, no pricing page.
- ❌ **Comments / community features** — no discussion, no reactions.
- ❌ Push notifications, email digests, or a newsletter.
- ❌ Personalization, keyword-follow, or filtering preferences.
- ❌ Search and long-term archive UX (data is retained in the DB; the UI shows a scrolling recent feed only).
- ❌ English or other non-Korean versions.
- ❌ Human editorial tooling (tier override, summary rewrite) — v1 is LLM-only; an admin surface is a candidate for v1.1 if quality demands it.
- ❌ Native mobile app.
