import * as cheerio from "cheerio";
import type { RawItem } from "../types";

export interface ScrapeConfig {
  pageUrl: string;
  /** CSS selector for article links on the index page. */
  linkSelector: string;
  baseUrl: string;
  /** Only keep hrefs matching this pattern (guards nav/footer links). */
  hrefPattern: RegExp;
  maxItems?: number;
}

/**
 * Generic index-page scraper for sources without RSS (Anthropic, Meta, Mistral,
 * xAI, Cursor — SOURCES.md). Selector-based on purpose: layout breakage should
 * be a one-line fix. No dates on most index pages → publishedAt null (first-seen).
 */
export async function fetchScrape(sourceId: string, cfg: ScrapeConfig): Promise<RawItem[]> {
  const res = await fetch(cfg.pageUrl, {
    headers: {
      "User-Agent": "promppy-feed-bot/0.1 (+https://promppy.com)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`scrape HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  const seen = new Set<string>();
  const items: RawItem[] = [];
  $(cfg.linkSelector).each((_, el) => {
    if (items.length >= (cfg.maxItems ?? 15)) return;
    const href = $(el).attr("href");
    // Card-style links concatenate category/date/blurb text; a heading inside
    // the anchor is the clean title when present.
    const heading = $(el).find("h1, h2, h3, h4").first().text();
    const title = (heading || $(el).text()).replace(/\s+/g, " ").trim();
    if (!href || !cfg.hrefPattern.test(href) || title.length < 12) return;
    const url = href.startsWith("http") ? href : new URL(href, cfg.baseUrl).toString();
    if (seen.has(url)) return;
    seen.add(url);
    items.push({ sourceId, url, title, publishedAt: null, excerpt: "" });
  });
  if (items.length === 0) throw new Error("scrape yielded 0 items — selector likely broken");
  return items;
}
