import type { RawItem, SourceResult } from "./types";
import { fetchRss } from "./adapters/rss";
import { fetchHackerNews } from "./adapters/hn";
import { fetchReddit } from "./adapters/reddit";
import { fetchHfPapers } from "./adapters/hfPapers";
import { fetchGithubChangelog } from "./adapters/githubChangelog";
import { fetchScrape } from "./adapters/scrape";
import { isAiRelevant } from "./relevance";

export interface SourceDef {
  id: string;
  name: string;
  /** Mixed-topic feed → apply keyword pre-filter before the LLM sees it. */
  preFilter?: boolean;
  fetch: (id: string) => Promise<RawItem[]>;
}

// The 19 sources from SOURCES.md (feeds validated 2026-07-10).
export const SOURCES: SourceDef[] = [
  // Group A — official labs
  { id: "openai", name: "OpenAI", fetch: (id) => fetchRss(id, "https://openai.com/news/rss.xml") },
  {
    id: "anthropic", name: "Anthropic",
    fetch: (id) => fetchScrape(id, {
      pageUrl: "https://www.anthropic.com/news", baseUrl: "https://www.anthropic.com",
      linkSelector: "a[href^='/news/']", hrefPattern: /^\/news\/.+/,
    }),
  },
  { id: "deepmind", name: "Google DeepMind", fetch: (id) => fetchRss(id, "https://deepmind.google/blog/rss.xml") },
  { id: "google-ai", name: "Google AI", fetch: (id) => fetchRss(id, "https://blog.google/technology/ai/rss/") },
  {
    id: "meta-ai", name: "Meta AI",
    fetch: (id) => fetchScrape(id, {
      pageUrl: "https://ai.meta.com/blog/", baseUrl: "https://ai.meta.com",
      linkSelector: "a[href*='/blog/']", hrefPattern: /\/blog\/.+/,
    }),
  },
  {
    id: "mistral", name: "Mistral AI",
    fetch: (id) => fetchScrape(id, {
      pageUrl: "https://mistral.ai/news", baseUrl: "https://mistral.ai",
      linkSelector: "a[href*='/news/']", hrefPattern: /\/news\/.+/,
    }),
  },
  // xAI (x.ai/news) dropped 2026-07-12: its scrape 403s from datacenter IPs on
  // every production crawl (works locally only). Grok news arrives via
  // TechCrunch/Reddit; keeping it only polluted the crawl error log.
  // Group B — tier-1 media & AI publications
  { id: "techcrunch", name: "TechCrunch", fetch: (id) => fetchRss(id, "https://techcrunch.com/category/artificial-intelligence/feed/") },
  { id: "verge", name: "The Verge", fetch: (id) => fetchRss(id, "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml") },
  { id: "ars", name: "Ars Technica", fetch: (id) => fetchRss(id, "https://arstechnica.com/ai/feed/") },
  { id: "venturebeat", name: "VentureBeat", fetch: (id) => fetchRss(id, "https://venturebeat.com/category/ai/feed/") },
  { id: "mit-tr", name: "MIT Tech Review", fetch: (id) => fetchRss(id, "https://www.technologyreview.com/topic/artificial-intelligence/feed") },
  { id: "wired", name: "Wired", fetch: (id) => fetchRss(id, "https://www.wired.com/feed/tag/ai/latest/rss") },
  // The Decoder (the-decoder.com) dropped: blocks Node HTTP clients (works via curl only).
  // Group C — community & aggregators
  { id: "hn", name: "Hacker News", fetch: (id) => fetchHackerNews(id) },
  {
    id: "reddit", name: "Reddit",
    fetch: (id) =>
      fetchReddit(
        id,
        [
          "LocalLLaMA", "MachineLearning", "OpenAI", "ClaudeAI", "artificial",
          "singularity", "StableDiffusion", "LLMDevs", "ChatGPTCoding", "cursor",
        ],
        40
      ),
  },
  { id: "simonw", name: "Simon Willison", preFilter: true, fetch: (id) => fetchRss(id, "https://simonwillison.net/atom/everything/") },
  { id: "hf-blog", name: "HF Blog", fetch: (id) => fetchRss(id, "https://huggingface.co/blog/feed.xml") },
  { id: "hf-papers", name: "HF Papers", fetch: (id) => fetchHfPapers(id) },
  // arXiv (#14) intentionally has no adapter — enters via hn / hf-papers (SPEC.md §3)
  // Group D — practitioner tools & vendor blogs
  { id: "nvidia", name: "NVIDIA", preFilter: true, fetch: (id) => fetchRss(id, "https://blogs.nvidia.com/feed/") },
  { id: "qwen", name: "Qwen", fetch: (id) => fetchRss(id, "https://qwenlm.github.io/blog/index.xml") },
  {
    id: "cursor", name: "Cursor",
    fetch: (id) => fetchScrape(id, {
      pageUrl: "https://cursor.com/changelog", baseUrl: "https://cursor.com",
      linkSelector: "a[href*='/changelog/']", hrefPattern: /\/changelog\/.+/, maxItems: 5,
    }),
  },
  {
    id: "claude-code", name: "Claude Code",
    fetch: (id) => fetchGithubChangelog(
      id,
      "https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md",
      "https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md",
      "Claude Code"
    ),
  },
  // Group E — Korean
  // AI타임스 pubDate has no timezone designator and is KST — parse it as such
  // or every item lands +9h in the future and pins to the top of the feed.
  { id: "aitimes", name: "AI타임스", fetch: (id) => fetchRss(id, "http://www.aitimes.com/rss/allArticle.xml", { naiveTzOffset: "+09:00" }) },
  { id: "geeknews", name: "GeekNews", preFilter: true, fetch: (id) => fetchRss(id, "https://news.hada.io/rss/news") },
  { id: "zdnet-kr", name: "ZDNet Korea", preFilter: true, fetch: (id) => fetchRss(id, "https://feeds.feedburner.com/zdkorea") },
];

export const SOURCE_NAMES: Record<string, string> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s.name])
);

export async function fetchSource(def: SourceDef): Promise<SourceResult> {
  try {
    let items = await def.fetch(def.id);
    if (def.preFilter) items = items.filter((i) => isAiRelevant(i.title, i.url));
    return { sourceId: def.id, ok: true, items };
  } catch (e) {
    return { sourceId: def.id, ok: false, items: [], error: e instanceof Error ? e.message : String(e) };
  }
}
