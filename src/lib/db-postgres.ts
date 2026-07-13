import { Pool } from "pg";
import type { Briefing, Classification, DupCoverage, FeedItem, RawItem, RecentItem, Tier } from "./types";
import { canonicalUrl, clampFuture, normalizeTitle, sha256, arrangeFeed, type RunStats, type UnclassifiedRow } from "./db-shared";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3, // serverless: keep connections minimal
    });
  }
  return pool;
}

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(
        `
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        source_id TEXT NOT NULL,
        url TEXT NOT NULL,
        url_hash TEXT NOT NULL UNIQUE,
        title_hash TEXT NOT NULL,
        title_orig TEXT NOT NULL,
        excerpt TEXT NOT NULL DEFAULT '',
        published_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        tier TEXT,
        headline_ko TEXT,
        why_ko TEXT,
        classified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_items_status_published ON items(status, published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_items_title_hash ON items(title_hash);
      CREATE TABLE IF NOT EXISTS crawl_runs (
        id SERIAL PRIMARY KEY,
        started_at TIMESTAMPTZ NOT NULL,
        finished_at TIMESTAMPTZ,
        ok_sources INTEGER NOT NULL DEFAULT 0,
        failed_sources INTEGER NOT NULL DEFAULT 0,
        new_items INTEGER NOT NULL DEFAULT 0,
        classified INTEGER NOT NULL DEFAULT 0,
        errors TEXT NOT NULL DEFAULT '[]'
      );
      ALTER TABLE items ADD COLUMN IF NOT EXISTS dup_of INTEGER;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS summary_ko TEXT;
      CREATE INDEX IF NOT EXISTS idx_items_dup_of ON items(dup_of);
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        item_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS briefings (
        date_kst TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `
      )
      .then(() => undefined);
  }
  return schemaReady;
}

export async function insertNewItems(items: RawItem[]): Promise<number> {
  await ensureSchema();
  const p = getPool();
  let inserted = 0;
  for (const r of items) {
    const url = canonicalUrl(r.url);
    const titleHash = sha256(normalizeTitle(r.title));
    const dupe = await p.query(
      `SELECT 1 FROM items WHERE title_hash = $1 AND published_at > now() - interval '2 days' LIMIT 1`,
      [titleHash]
    );
    if (dupe.rowCount) continue;
    const res = await p.query(
      `INSERT INTO items (source_id, url, url_hash, title_hash, title_orig, excerpt, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (url_hash) DO NOTHING`,
      [r.sourceId, url, sha256(url), titleHash, r.title, r.excerpt.slice(0, 1500), clampFuture(r.publishedAt)]
    );
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

export async function getUnclassified(limit = 60): Promise<UnclassifiedRow[]> {
  await ensureSchema();
  const res = await getPool().query(
    `SELECT id, source_id, url, title_orig, excerpt, published_at FROM items
     WHERE status = 'new' ORDER BY published_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows.map((r) => ({ ...r, published_at: new Date(r.published_at).toISOString() }));
}

function statusFor(action: Classification["action"]): string {
  return action === "publish" ? "published" : action === "duplicate" ? "duplicate" : "skipped";
}

export async function applyClassification(id: number, c: Classification): Promise<void> {
  await getPool().query(
    `UPDATE items SET status = $1, tier = $2, headline_ko = $3, why_ko = $4,
     dup_of = $5, classified_at = now() WHERE id = $6`,
    [
      statusFor(c.action),
      c.tier,
      c.headline_ko || null,
      c.why_ko || null,
      c.action === "duplicate" ? (c.duplicate_of ?? null) : null,
      id,
    ]
  );
}

export async function getRecentPublished(limit = 80): Promise<RecentItem[]> {
  await ensureSchema();
  const res = await getPool().query(
    `SELECT id, source_id, title_orig, headline_ko FROM items
     WHERE status = 'published' AND published_at > now() - interval '3 days'
     ORDER BY published_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows as RecentItem[];
}

/** Suppressed duplicates that point at this published story ("다른 매체 보도"). */
export async function getDupCoverage(itemId: number): Promise<DupCoverage[]> {
  await ensureSchema();
  const res = await getPool().query(
    `SELECT source_id, title_orig, url FROM items
     WHERE dup_of = $1 AND status = 'duplicate' ORDER BY published_at DESC LIMIT 6`,
    [itemId]
  );
  return res.rows.map((r) => ({ sourceId: r.source_id, titleOrig: r.title_orig, url: r.url }));
}

export async function getLatestPublished(excludeId: number, limit = 5): Promise<FeedItem[]> {
  await ensureSchema();
  const res = await getPool().query(
    `SELECT id, source_id, url, title_orig, headline_ko, why_ko, tier, published_at
     FROM items WHERE status = 'published' AND id <> $1
     ORDER BY published_at DESC LIMIT $2`,
    [excludeId, limit]
  );
  return res.rows.map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    sourceName: r.source_id,
    url: r.url,
    titleOrig: r.title_orig,
    headlineKo: r.headline_ko,
    whyKo: r.why_ko,
    tier: r.tier as Tier,
    publishedAt: new Date(r.published_at).toISOString(),
  }));
}

export async function addFeedback(itemId: number): Promise<void> {
  await ensureSchema();
  await getPool().query(`INSERT INTO feedback (item_id) VALUES ($1)`, [itemId]);
}

export async function getBriefing(dateKst: string): Promise<Briefing | null> {
  await ensureSchema();
  const res = await getPool().query(`SELECT date_kst, content FROM briefings WHERE date_kst = $1`, [dateKst]);
  const r = res.rows[0];
  return r ? { dateKst: r.date_kst, content: r.content } : null;
}

export async function saveBriefing(dateKst: string, content: string): Promise<void> {
  await getPool().query(
    `INSERT INTO briefings (date_kst, content) VALUES ($1, $2) ON CONFLICT (date_kst) DO NOTHING`,
    [dateKst, content]
  );
}

/** Top material of the last 24h for the morning briefing (속보/중요 first). */
export async function getTopForBriefing(limit = 12): Promise<Array<{ headline_ko: string; why_ko: string; tier: Tier }>> {
  await ensureSchema();
  const res = await getPool().query(
    `SELECT headline_ko, why_ko, tier FROM items
     WHERE status = 'published' AND classified_at > now() - interval '24 hours'
     ORDER BY CASE tier WHEN '속보' THEN 0 WHEN '중요' THEN 1 ELSE 2 END, published_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

export async function getItem(id: number): Promise<FeedItem | null> {
  await ensureSchema();
  const res = await getPool().query(
    `SELECT id, source_id, url, title_orig, headline_ko, why_ko, tier, published_at, summary_ko
     FROM items WHERE id = $1 AND status = 'published'`,
    [id]
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    sourceId: r.source_id,
    sourceName: r.source_id,
    url: r.url,
    titleOrig: r.title_orig,
    headlineKo: r.headline_ko,
    whyKo: r.why_ko,
    tier: r.tier as Tier,
    publishedAt: new Date(r.published_at).toISOString(),
    summaryKo: r.summary_ko ?? null,
  };
}

export async function saveSummary(id: number, summaryKo: string): Promise<void> {
  await getPool().query(`UPDATE items SET summary_ko = $1 WHERE id = $2`, [summaryKo, id]);
}

export async function getFeed(limit = 100): Promise<FeedItem[]> {
  await ensureSchema();
  // Fetch a recency-sorted candidate pool with headroom; per-source caps and
  // no-consecutive-source interleaving happen in arrangeFeed (db-shared.ts).
  const res = await getPool().query(
    `SELECT id, source_id, url, title_orig, headline_ko, why_ko, tier, published_at
     FROM items WHERE status = 'published' ORDER BY published_at DESC LIMIT $1`,
    [limit * 4]
  );
  const rows: FeedItem[] = res.rows.map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    sourceName: r.source_id,
    url: r.url,
    titleOrig: r.title_orig,
    headlineKo: r.headline_ko,
    whyKo: r.why_ko,
    tier: r.tier as Tier,
    publishedAt: new Date(r.published_at).toISOString(),
  }));
  return arrangeFeed(rows, limit);
}

// Load-more pagination: strictly-older items in plain reverse-chronological
// order (no caps/interleave — that's a front-page presentation concern).
export async function getFeedBefore(beforeIso: string, limit = 50): Promise<FeedItem[]> {
  await ensureSchema();
  const res = await getPool().query(
    `SELECT id, source_id, url, title_orig, headline_ko, why_ko, tier, published_at
     FROM items WHERE status = 'published' AND published_at < $1
     ORDER BY published_at DESC LIMIT $2`,
    [beforeIso, limit]
  );
  return res.rows.map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    sourceName: r.source_id,
    url: r.url,
    titleOrig: r.title_orig,
    headlineKo: r.headline_ko,
    whyKo: r.why_ko,
    tier: r.tier as Tier,
    publishedAt: new Date(r.published_at).toISOString(),
  }));
}

export async function startRun(): Promise<number> {
  await ensureSchema();
  const res = await getPool().query(`INSERT INTO crawl_runs (started_at) VALUES (now()) RETURNING id`);
  return res.rows[0].id;
}

export async function finishRun(id: number, stats: RunStats): Promise<void> {
  await getPool().query(
    `UPDATE crawl_runs SET finished_at = now(), ok_sources = $1, failed_sources = $2,
     new_items = $3, classified = $4, errors = $5 WHERE id = $6`,
    [stats.okSources, stats.failedSources, stats.newItems, stats.classified, JSON.stringify(stats.errors), id]
  );
}

export async function lastSuccessfulRun(): Promise<{ finished_at: string } | undefined> {
  await ensureSchema();
  const res = await getPool().query(
    `SELECT finished_at FROM crawl_runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1`
  );
  const row = res.rows[0];
  return row ? { finished_at: new Date(row.finished_at).toISOString() } : undefined;
}
