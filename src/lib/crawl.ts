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
import { classifyItem, gateItem, generateBriefing, summarizeArticle } from "./classify";
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
      // Enrich short/empty excerpts with article text so the gate, the
      // classification, and the item-page summary judge from real body text.
      // (X posts and Reddit self-posts already carry their full text.)
      let excerpt = p.excerpt;
      if (excerpt.trim().length < 400 && p.source_id !== "x" && p.source_id !== "reddit") {
        const article = await fetchArticleText(p.url);
        if (article.length > excerpt.trim().length) excerpt = article;
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
        context.unshift({ id: p.id, source_id: p.source_id, title_orig: p.title_orig, headline_ko: result.headline_ko });
        // Item-page Korean summary (Gemini; "" on failure → column stays null).
        const summary = await summarizeArticle({ sourceId: p.source_id, title: p.title_orig, text: excerpt });
        if (summary) await saveSummary(p.id, summary);
      } else if (result.action === "duplicate") {
        duplicates++;
      }
    } catch (e) {
      errors.push(`classify #${p.id}: ${e instanceof Error ? e.message : String(e)}`);
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
