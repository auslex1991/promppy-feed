import { SOURCES, fetchSource } from "./sources";
import {
  insertNewItems,
  getUnclassified,
  getRecentPublished,
  applyClassification,
  startRun,
  finishRun,
  getBriefing,
  saveBriefing,
  getTopForBriefing,
  saveSummary,
} from "./db";
import { classifyGeminiBatch, classifyItem, gateItem, generateBriefing, summarizeArticle, type BatchItem } from "./classify";
import { fetchArticleText } from "./adapters/article";
import { sendPushToAll, breakingPayload } from "./push";
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
  // Wall-clock budget: Vercel kills the function at maxDuration (300s), which
  // previously left runs unfinished and items re-processing forever during a
  // provider incident. Stop classifying at 230s and finish cleanly — leftovers
  // stay 'new' and the next crawl (15-min cadence) picks them up.
  const deadline = Date.now() + 230_000;

  // Fetch every source concurrently; one failure never fails the run (SOURCES.md).
  const results = await Promise.all(SOURCES.map(fetchSource));
  const okSources = results.filter((r) => r.ok).length;
  for (const r of results.filter((r) => !r.ok)) {
    errors.push(`${r.sourceId}: ${r.error}`);
  }

  const inserted = await insertNewItems(results.flatMap((r) => r.items));

  // Classify everything still 'new' (includes retries from previously failed
  // runs). Gate per-item (cheap), then classify in BATCHES of 8 so the fixed
  // prompt overhead (rubric + dedup context) is paid per batch, not per item —
  // and same-batch dedup is seen by the model all at once.
  const pending = await getUnclassified();
  const context: RecentItem[] = await getRecentPublished(40);
  let gatedOut = 0;
  let classified = 0;
  let duplicates = 0;

  // Enrich + gate, collecting survivors for batched classification.
  const survivors: BatchItem[] = [];
  for (const p of pending) {
    if (Date.now() > deadline) {
      errors.push("time budget reached during gating — remaining items deferred to next crawl");
      break;
    }
    try {
      // Enrich short/empty excerpts with article text so the gate, the
      // classification, and the item-page summary judge from real body text.
      // (X posts and Reddit self-posts already carry their full text.)
      let excerpt = p.excerpt;
      if (excerpt.trim().length < 400 && p.source_id !== "x" && p.source_id !== "reddit") {
        const article = await fetchArticleText(p.url);
        if (article.length > excerpt.trim().length) excerpt = article;
      }
      const keep = await gateItem({ sourceId: p.source_id, title: p.title_orig, excerpt });
      if (!keep) {
        await applyClassification(p.id, SKIP);
        gatedOut++;
        continue;
      }
      survivors.push({
        id: p.id,
        sourceId: p.source_id,
        title: p.title_orig,
        publishedAt: p.published_at,
        excerpt,
      });
    } catch (e) {
      errors.push(`gate #${p.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const BATCH = 8;
  for (let i = 0; i < survivors.length; i += BATCH) {
    if (Date.now() > deadline) {
      errors.push("time budget reached during classification — remaining items deferred to next crawl");
      break;
    }
    const batch = survivors.slice(i, i + BATCH);
    let resultsMap: Map<number, Classification>;
    try {
      resultsMap = await classifyGeminiBatch(batch, context);
    } catch (e) {
      // Batch failed (Gemini outage, malformed output) — per-item path, which
      // itself falls back to all-Claude. Never stall the feed on one provider.
      errors.push(`batch classify: ${e instanceof Error ? e.message : String(e)} — per-item fallback`);
      resultsMap = new Map();
      for (const p of batch) {
        try {
          resultsMap.set(p.id, await classifyItem(p, context));
        } catch (e2) {
          errors.push(`classify #${p.id}: ${e2 instanceof Error ? e2.message : String(e2)}`);
        }
      }
    }
    for (const p of batch) {
      const result = resultsMap.get(p.id);
      if (!result) continue; // stays 'new' — retried next crawl
      await applyClassification(p.id, result);
      if (result.action === "publish") {
        classified++;
        context.unshift({ id: p.id, source_id: p.sourceId, title_orig: p.title, headline_ko: result.headline_ko });
        // 속보 push: fire-and-forget to subscribers. Rare (≤2-3/week), never
        // blocks the crawl, and failures are swallowed inside sendPushToAll.
        if (result.tier === "속보") {
          try {
            const { sent, pruned } = await sendPushToAll(breakingPayload(result.headline_ko, p.id));
            console.log(`속보 push #${p.id}: sent=${sent} pruned=${pruned}`);
          } catch (e) {
            errors.push(`push #${p.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        // Item-page Korean summary (Gemini; "" on failure → column stays null).
        if (Date.now() < deadline) {
          const summary = await summarizeArticle({ sourceId: p.sourceId, title: p.title, text: p.excerpt });
          if (summary) await saveSummary(p.id, summary);
        }
      } else if (result.action === "duplicate") {
        duplicates++;
      }
    }
  }

  // 오늘의 브리핑: once per KST day, first crawl at/after 07:00 KST writes it.
  try {
    const nowD = new Date();
    const kstDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(nowD);
    const kstHour = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(nowD)
    );
    if (kstHour >= 7 && !(await getBriefing(kstDate))) {
      const top = await getTopForBriefing(12);
      if (top.length >= 4) {
        const content = await generateBriefing(top);
        if (content) await saveBriefing(kstDate, content);
      }
    }
  } catch (e) {
    errors.push(`briefing: ${e instanceof Error ? e.message : String(e)}`);
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
