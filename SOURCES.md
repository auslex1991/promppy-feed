# SOURCES — Crawl Targets

**Version:** v1 draft (2026-07-10)
**Companion doc:** [SPEC.md](SPEC.md)

26 active sources across five groups (19 at v1 draft; 8 added and 1 dropped 2026-07-10). Each entry lists the URL, ingestion method (RSS / scrape / API), and expected post frequency, plus notes that affect implementation.

> ✅ **Feeds validated 2026-07-10.** All RSS/API URLs below returned HTTP 200 with parseable content, except Meta AI (all known RSS paths 404 → moved to scrape). Re-validate periodically; publishers move feeds without notice.

Expected total inflow after the relevance filter: roughly **50–100 publishable items/day**, consistent with the tier volume estimates in SPEC.md §3.

---

## Group A — Official AI lab blogs (7)

Highest authority; these win deduplication against media coverage of the same story (SPEC.md §4).

| # | Source | URL | Ingestion | Frequency | Notes |
|---|--------|-----|-----------|-----------|-------|
| 1 | OpenAI News | https://openai.com/news/ | RSS: `https://openai.com/news/rss.xml` ✅ | 3–5/week | Primary 속보 source. Includes product, research, and company news. |
| 2 | Anthropic News | https://www.anthropic.com/news | **Scrape** (no public RSS) | 2–4/week | Next.js site; parse the news index page. Primary 속보 source. |
| 3 | Google DeepMind Blog | https://deepmind.google/discover/blog/ | RSS: `https://deepmind.google/blog/rss.xml` ✅ | 2–3/week | Research-heavy; many items will tier as 참고. |
| 4 | Google — The Keyword (AI) | https://blog.google/technology/ai/ | RSS: `https://blog.google/technology/ai/rss/` ✅ | 5–8/week | Google's product-side AI announcements (Gemini launches land here). Overlaps DeepMind occasionally — dedup handles it. |
| 5 | Meta AI Blog | https://ai.meta.com/blog/ | **Scrape** (RSS paths all 404 as of 2026-07-10) | 1–3/week | Llama releases, FAIR research. |
| 6 | Mistral AI News | https://mistral.ai/news/ | **Scrape** (no reliable RSS) | 1–2/week | Low volume, high signal for open-weights releases. |
| 7 | xAI News | https://x.ai/news | **Scrape** | ~1/week | Grok releases. Low volume; cheap to include. |

## Group B — Tier-1 tech media, AI sections (3)

High volume; the relevance filter and dedup do real work here. Media items lose dedup ties to Group A.

| # | Source | URL | Ingestion | Frequency | Notes |
|---|--------|-----|-----------|-----------|-------|
| 8 | TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/ | RSS: `https://techcrunch.com/category/artificial-intelligence/feed/` ✅ | 8–15/day | Best coverage of funding rounds and startup news (중요 criteria #4). |
| 9 | The Verge — AI | https://www.theverge.com/ai-artificial-intelligence | RSS (Atom): `https://www.theverge.com/rss/ai-artificial-intelligence/index.xml` ✅ | 5–8/day | Strong on consumer-facing AI product news and outage coverage. |
| 10 | Ars Technica AI | https://arstechnica.com/ai/ | RSS: `https://arstechnica.com/ai/feed/` ✅ | 2–4/day | More technical/analytical; skews 참고. |
| 10b | VentureBeat AI | https://venturebeat.com/category/ai/ | RSS: `https://venturebeat.com/category/ai/feed/` ✅ | 5–10/day | Enterprise AI angle; complements TechCrunch. Added 2026-07-10. |
| 10c | MIT Technology Review AI | https://www.technologyreview.com/topic/artificial-intelligence/ | RSS: `https://www.technologyreview.com/topic/artificial-intelligence/feed` ✅ | 1–3/day | Analysis/depth; skews 참고. Added 2026-07-10. |
| 10d | Wired AI | https://www.wired.com/tag/ai/ | RSS: `https://www.wired.com/feed/tag/ai/latest/rss` ✅ | 2–5/day | Added 2026-07-10. |
| ~~10e~~ | ~~The Decoder~~ | https://the-decoder.com | **Dropped** | — | Feed blocks Node HTTP clients (TLS-fingerprint filtering; responds to curl only). Revisit if they open up. |

## Group C — Community & aggregators (6)

> **X/Twitter is deliberately absent:** the free API tier cannot read/search tweets, paid read access starts at ~$200/month, and scraping violates X's ToS. HN + Reddit + GeekNews capture most virally-trending AI content within hours. Revisit if the budget justifies a paid X integration.

| # | Source | URL | Ingestion | Frequency | Notes |
|---|--------|-----|-----------|-----------|-------|
| 11 | Hacker News (AI-filtered) | https://news.ycombinator.com | **API**: Algolia HN Search (`https://hn.algolia.com/api/v1/search?tags=front_page`) | 10–20 relevant/day | Fetch front page; keep items whose title/domain matches AI keyword+domain lists (openai.com, anthropic.com, arxiv.org, model names, etc.), plus points threshold (e.g. ≥ 100). HN traction is itself a signal — an arXiv link on the HN front page enters the feed via this source. |
| 11b | Reddit (AI subreddits) | r/LocalLLaMA, r/MachineLearning, r/OpenAI, r/ClaudeAI, r/artificial | **RSS**: `https://www.reddit.com/r/<multi>/hot.rss` ✅ (JSON API 403s unauthenticated clients) | top 15 of hot per crawl | Hot-ranking order substitutes for a score threshold. Community chatter (opinions, help posts, memes) is filtered by an explicit rule in the classifier prompt. Added 2026-07-10. |
| 11c | Simon Willison's Weblog | https://simonwillison.net | RSS (Atom): `https://simonwillison.net/atom/everything/` ✅ | 2–5/day | The highest-signal individual practitioner blog for LLM tooling. Keyword pre-filter applied (personal blog, occasional off-topic). Added 2026-07-10. |
| 12 | Hugging Face Blog | https://huggingface.co/blog | RSS: `https://huggingface.co/blog/feed.xml` ✅ | 1–3/day | Open-source ecosystem releases and technique posts. |
| 13 | Hugging Face Daily Papers | https://huggingface.co/papers | **API**: `https://huggingface.co/api/daily_papers` ✅ (JSON) | ~20 papers/day, take top ~3–5 by upvotes | This is the **primary arXiv gateway** (see #14). Daily batch, not continuous — crawl once per cycle, ingest only papers above an upvote threshold. |
| 14 | arXiv cs.AI / cs.LG | https://arxiv.org/list/cs.AI/recent | **Not crawled directly** | — | Per SPEC.md §3: papers enter the feed only with external traction — via HN front page (#11) or HF Daily Papers (#13). The arXiv API (`https://export.arxiv.org/api/query`) is used only to enrich metadata (authors, abstract) for papers that arrive through those signals. Raw cs.AI/cs.LG volume (hundreds/day) would drown the feed. |

## Group D — Practitioner tools & vendor blogs (4)

Directly serves the target audience (Cursor/Claude users). Cheap to crawl, disproportionately high "why it matters" value.

| # | Source | URL | Ingestion | Frequency | Notes |
|---|--------|-----|-----------|-----------|-------|
| 15 | Cursor Changelog | https://cursor.com/changelog | **Scrape** | 1–2/week | Major versions tier as 중요 (criteria #2). |
| 16 | Claude Code Changelog | https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md | **API**: GitHub (raw file or commits API/atom feed) | several/week | Diff against last-seen version; batch minor entries. GitHub API is rate-limit-friendly with a token. |
| 16b | NVIDIA Blog | https://blogs.nvidia.com | RSS: `https://blogs.nvidia.com/feed/` ✅ | 2–5/day, ~half AI-relevant | Mixed feed (gaming/graphics too) — keyword pre-filter applied. GPU/inference infra news. Added 2026-07-10. |
| 16c | Qwen Blog | https://qwenlm.github.io/blog/ | RSS: `https://qwenlm.github.io/blog/index.xml` ✅ | 1–2/week | Top open-weights lab (중요 criteria #1); releases often break here before media coverage. Added 2026-07-10. |

## Group E — Korean sources (3)

Serves 중요 criteria #6 (Korean AI industry news) and gives the feed local grounding.

| # | Source | URL | Ingestion | Frequency | Notes |
|---|--------|-----|-----------|-----------|-------|
| 17 | AI타임스 | https://www.aitimes.com | RSS: `http://www.aitimes.com/rss/allArticle.xml` ✅ | 10–20/day | The dedicated Korean AI outlet. High volume; much of it is translated coverage of stories we already have from Groups A/B — dedup by story matching matters here. Korean-original reporting (Naver/Kakao/policy) is the unique value. |
| 18 | GeekNews (긱뉴스) | https://news.hada.io | RSS (Atom): `https://news.hada.io/rss/news` ✅ | 5–10 relevant/day | Korean dev community aggregator (HN-like). Filter by AI keywords/topics. Signals what Korean developers are actually discussing. |
| 19 | ZDNet Korea | https://zdnet.co.kr | RSS: `https://feeds.feedburner.com/zdkorea` ✅ (all-articles feed; AI-filter downstream) | 5–10/day AI-relevant | Mainstream Korean tech coverage of Samsung/LG/SKT/Naver AI moves. Feed is site-wide — relevance filter does the AI selection. |

---

## Implementation notes (cross-source)

- **Per-source adapter interface.** Every source normalizes to the same shape: `{ source_id, url, title, published_at, excerpt }`. RSS sources share one parser; scrape sources each get a small adapter; API sources (HN, GitHub) get theirs. New sources should be a one-adapter addition.
- **Politeness:** 15-minute interval is well within acceptable crawl rates for all of these. Send a honest User-Agent (`promppy-feed-bot`), respect robots.txt for scrape targets, and use conditional GETs (ETag / If-Modified-Since) on RSS feeds to keep fetches cheap.
- **Failure isolation:** one source failing (layout change, feed 404) must not fail the crawl run. Log per-source status into `crawl_runs`; a source failing for > 24h should surface somewhere visible (even just a log-based alert in v1).
- **Scrape fragility budget:** 6 of 19 sources are scrapes (Anthropic, Mistral, xAI, Cursor, HF Papers + fallbacks). Expect layout breakage; keep adapters tiny and selector-based so fixes are one-liners.
