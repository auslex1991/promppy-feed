import { Pool } from "pg";
import type { Classification, FeedItem, RawItem, Tier } from "./types";
import { canonicalUrl, normalizeTitle, sha256, PER_SOURCE_CAP, type RunStats, type UnclassifiedRow } from "./db-shared";

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
      [r.sourceId, url, sha256(url), titleHash, r.title, r.excerpt.slice(0, 1500), r.publishedAt ?? new Date().toISOString()]
    );
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

export async function getUnclassified(limit = 60): Promise<UnclassifiedRow[]> {
  await ensureSchema();
  const res = await getPool().query(
    `SELECT id, source_id, title_orig, excerpt, published_at FROM items
     WHERE status = 'new' ORDER BY published_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows.map((r) => ({ ...r, published_at: new Date(r.published_at).toISOString() }));
}

export async function applyClassification(id: number, c: Classification): Promise<void> {
  await getPool().query(
    `UPDATE items SET status = $1, tier = $2, headline_ko = $3, why_ko = $4, classified_at = now() WHERE id = $5`,
    [c.action === "publish" ? "published" : "skipped", c.tier, c.headline_ko || null, c.why_ko || null, id]
  );
}

export async function getFeed(limit = 100): Promise<FeedItem[]> {
  await ensureSchema();
  // Rank each source's items by recency, keep at most PER_SOURCE_CAP per source,
  // then take the most-recent `limit` of what remains — display fairness so no
  // single high-volume source dominates.
  const res = await getPool().query(
    `SELECT id, source_id, url, title_orig, headline_ko, why_ko, tier, published_at FROM (
       SELECT id, source_id, url, title_orig, headline_ko, why_ko, tier, published_at,
              ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY published_at DESC) AS rn
       FROM items WHERE status = 'published'
     ) ranked
     WHERE rn <= $1
     ORDER BY published_at DESC LIMIT $2`,
    [PER_SOURCE_CAP, limit]
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
