import { SOURCES, fetchSource } from "./sources";
import { insertNewItems, getUnclassified, applyClassification, startRun, finishRun } from "./db";
import { classifyBatch } from "./classify";

export interface CrawlStats {
  okSources: number;
  failedSources: number;
  newItems: number;
  classified: number;
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
  const pending = await getUnclassified();
  let classified = 0;
  if (pending.length > 0) {
    const outcomes = await classifyBatch(
      pending.map((p) => ({
        id: p.id,
        sourceId: p.source_id,
        title: p.title_orig,
        publishedAt: p.published_at,
        excerpt: p.excerpt,
      }))
    );
    for (const o of outcomes) {
      if (o.result instanceof Error) {
        errors.push(`classify #${o.id}: ${o.result.message}`);
      } else {
        await applyClassification(o.id, o.result);
        classified++;
      }
    }
  }

  const stats: CrawlStats = {
    okSources,
    failedSources: results.length - okSources,
    newItems: inserted,
    classified,
    errors,
  };
  await finishRun(runId, stats);
  return stats;
}
