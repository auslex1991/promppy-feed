import Parser from "rss-parser";
import type { RawItem } from "../types";

function makeParser(timeoutMs: number) {
  return new Parser({
    timeout: timeoutMs,
    headers: { "User-Agent": "promppy-feed-bot/0.1 (+https://promppy.com)" },
  });
}

const parser = makeParser(15000);

const HAS_TZ = /([+-]\d{2}:?\d{2}|GMT|UTC|Z)\s*$/i;

export interface RssOptions {
  maxItems?: number;
  timeoutMs?: number;
  /**
   * IANA-less fix for feeds whose pubDate carries NO timezone designator
   * (e.g. AI타임스 emits "2026-07-12 12:57:09" meaning KST). Without this the
   * naive string parses as UTC, landing items up to +9h in the FUTURE and
   * pinning them to the top of the feed. Applied only when the raw date
   * actually lacks a timezone.
   */
  naiveTzOffset?: string; // e.g. "+09:00"
}

function parseDate(it: { isoDate?: string; pubDate?: string }, opts: RssOptions): string | null {
  const raw = it.pubDate;
  if (opts.naiveTzOffset && raw && !HAS_TZ.test(raw.trim())) {
    const d = new Date(raw.trim().replace(" ", "T") + opts.naiveTzOffset);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (it.isoDate) return it.isoDate;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

export async function fetchRss(
  sourceId: string,
  feedUrl: string,
  maxItemsOrOpts: number | RssOptions = 30,
  timeoutMs?: number
): Promise<RawItem[]> {
  const opts: RssOptions =
    typeof maxItemsOrOpts === "number" ? { maxItems: maxItemsOrOpts, timeoutMs } : maxItemsOrOpts;
  const feed = await (opts.timeoutMs ? makeParser(opts.timeoutMs) : parser).parseURL(feedUrl);
  return (feed.items ?? []).slice(0, opts.maxItems ?? 30).flatMap((it) => {
    if (!it.link || !it.title) return [];
    const excerpt = (it.contentSnippet || it.content || it.summary || "").toString();
    return [
      {
        sourceId,
        url: it.link,
        title: it.title.trim(),
        publishedAt: parseDate(it, opts),
        excerpt,
      },
    ];
  });
}
