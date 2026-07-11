import { SOURCES, fetchSource } from "./sources";
import {
  insertNewItems,
  getUnclassified,
  getRecentPublished,
  applyClassification,
  startRun,
  finishRun,
} from "./db";
import { classifyItem, gateItem } from "./classify";
import { fetchArticleText } from "./adapters/article";
import type { Classification, RecentItem } from "./types";

const SKIP: Classification = { action: "skip", tier: null, headline_ko: "", why_ko: "" };

export interface CrawlStats {
  okSources: number;
  failedSources: number;
  newItems: number;
  gatedOut: number;
  classified: number;
  duplicates: number;
  errors: string[];
}

/** The SPEC.md §5 pipeline: fetch all → dedup+insert → classify new → done. */
export async function runCrawl(): Promise<CrawlStats> {
  const runId = await startRun();
  const errors: string[] = [];

  // Fetch every source concurrently; one failure never fails the run (SOURCES.md).
  const results = await Promise.all(SOURCES.map(fetchSource));
  const okSources = results.filter((r) => r.ok).length;
  for (const r of results.filter((r) => !r.ok)) {
    errors.push(`${r.sourceId}: ${r.error}`);
  }

  const inserted = await insertNewItems(results.flatMap((r) => r.items));

  // Classify everything still 'new' (includes retries from previously failed runs).
  // Sequential (not parallel) so cross-language dedup sees items published earlier
  // in THIS run too — otherwise two same-story items in one crawl both slip through.
  const pending = await getUnclassified();
  const context: RecentItem[] = await getRecentPublished(40);
  let gatedOut = 0;
  let classified = 0;
  let duplicates = 0;
  for (const p of pending) {
    try {
      // Enrich empty-excerpt items (scraped blogs, HF Blog) with article text
      // so both the gate and the summary judge from body, not just a headline.
      let excerpt = p.excerpt;
      if (!excerpt.trim()) {
        excerpt = await fetchArticleText(p.url);
      }

      // Stage 1 — cheap Haiku relevance gate (no dedup context).
      const keep = await gateItem({ sourceId: p.source_id, title: p.title_orig, excerpt });
      if (!keep) {
        await applyClassification(p.id, SKIP);
        gatedOut++;
        continue;
      }

      // Stage 2 — Opus finalize: tier + Korean summary + cross-language dedup.
      const result = await classifyItem(
        { sourceId: p.source_id, title: p.title_orig, publishedAt: p.published_at, excerpt },
        context
      );
      await applyClassification(p.id, result);
      if (result.action === "publish") {
        classified++;
        context.unshift({ source_id: p.source_id, title_orig: p.title_orig, headline_ko: result.headline_ko });
      } else if (result.action === "duplicate") {
        duplicates++;
      }
    } catch (e) {
      errors.push(`classify #${p.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const stats: CrawlStats = {
    okSources,
    failedSources: results.length - okSources,
    newItems: inserted,
    gatedOut,
    classified,
    duplicates,
    errors,
  };
  await finishRun(runId, stats);
  return stats;
}
