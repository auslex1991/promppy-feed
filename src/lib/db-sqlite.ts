import fs from "fs";
import path from "path";
import type BetterSqlite3 from "better-sqlite3";
import type { Classification, FeedItem, RawItem, Tier } from "./types";
import { canonicalUrl, normalizeTitle, sha256, type RunStats, type UnclassifiedRow } from "./db-shared";

// Local-dev backend. Loaded lazily so production builds (Postgres path) never
// touch the native better-sqlite3 binding.
const DATA_DIR = path.join(process.cwd(), "data");

let db: BetterSqlite3.Database | null = null;

async function getDb(): Promise<BetterSqlite3.Database> {
  if (db) return db;
  const { default: Database } = await import("better-sqlite3");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(path.join(DATA_DIR, "promppy.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      url TEXT NOT NULL,
      url_hash TEXT NOT NULL UNIQUE,
      title_hash TEXT NOT NULL,
      title_orig TEXT NOT NULL,
      excerpt TEXT NOT NULL DEFAULT '',
      published_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      tier TEXT,
      headline_ko TEXT,
      why_ko TEXT,
      classified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_items_status_published ON items(status, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_items_title_hash ON items(title_hash);

    CREATE TABLE IF NOT EXISTS crawl_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      ok_sources INTEGER NOT NULL DEFAULT 0,
      failed_sources INTEGER NOT NULL DEFAULT 0,
      new_items INTEGER NOT NULL DEFAULT 0,
      classified INTEGER NOT NULL DEFAULT 0,
      errors TEXT NOT NULL DEFAULT '[]'
    );
  `);
  return db;
}

export async function insertNewItems(items: RawItem[]): Promise<number> {
  const d = await getDb();
  const insert = d.prepare(`
    INSERT OR IGNORE INTO items (source_id, url, url_hash, title_hash, title_orig, excerpt, published_at)
    VALUES (@sourceId, @url, @urlHash, @titleHash, @title, @excerpt, @publishedAt)
  `);
  const titleDupe = d.prepare(
    `SELECT 1 FROM items WHERE title_hash = ? AND published_at > datetime('now', '-2 days') LIMIT 1`
  );
  let inserted = 0;
  const tx = d.transaction((rows: RawItem[]) => {
    for (const r of rows) {
      const url = canonicalUrl(r.url);
      const titleHash = sha256(normalizeTitle(r.title));
      if (titleDupe.get(titleHash)) continue;
      const res = insert.run({
        sourceId: r.sourceId,
        url,
        urlHash: sha256(url),
        titleHash,
        title: r.title,
        excerpt: r.excerpt.slice(0, 1500),
        publishedAt: r.publishedAt ?? new Date().toISOString(),
      });
      inserted += res.changes;
    }
  });
  tx(items);
  return inserted;
}

export async function getUnclassified(limit = 60): Promise<UnclassifiedRow[]> {
  const d = await getDb();
  return d
    .prepare(
      `SELECT id, source_id, title_orig, excerpt, published_at
       FROM items WHERE status = 'new' ORDER BY published_at DESC LIMIT ?`
    )
    .all(limit) as UnclassifiedRow[];
}

export async function applyClassification(id: number, c: Classification): Promise<void> {
  const d = await getDb();
  d.prepare(
    `UPDATE items SET status = @status, tier = @tier, headline_ko = @headline,
     why_ko = @why, classified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = @id`
  ).run({
    id,
    status: c.action === "publish" ? "published" : "skipped",
    tier: c.tier,
    headline: c.headline_ko || null,
    why: c.why_ko || null,
  });
}

export async function getFeed(limit = 100): Promise<FeedItem[]> {
  const d = await getDb();
  const rows = d
    .prepare(
      `SELECT id, source_id, url, title_orig, headline_ko, why_ko, tier, published_at
       FROM items WHERE status = 'published' ORDER BY published_at DESC LIMIT ?`
    )
    .all(limit) as Array<{
    id: number;
    source_id: string;
    url: string;
    title_orig: string;
    headline_ko: string;
    why_ko: string;
    tier: Tier;
    published_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    sourceName: r.source_id,
    url: r.url,
    titleOrig: r.title_orig,
    headlineKo: r.headline_ko,
    whyKo: r.why_ko,
    tier: r.tier,
    publishedAt: r.published_at,
  }));
}

export async function startRun(): Promise<number> {
  const d = await getDb();
  const res = d
    .prepare(`INSERT INTO crawl_runs (started_at) VALUES (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
    .run();
  return Number(res.lastInsertRowid);
}

export async function finishRun(id: number, stats: RunStats): Promise<void> {
  const d = await getDb();
  d.prepare(
    `UPDATE crawl_runs SET finished_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
     ok_sources = ?, failed_sources = ?, new_items = ?, classified = ?, errors = ? WHERE id = ?`
  ).run(stats.okSources, stats.failedSources, stats.newItems, stats.classified, JSON.stringify(stats.errors), id);
}

export async function lastSuccessfulRun(): Promise<{ finished_at: string } | undefined> {
  const d = await getDb();
  return d
    .prepare(`SELECT finished_at FROM crawl_runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1`)
    .get() as { finished_at: string } | undefined;
}
