import fs from "fs";
import path from "path";
import type BetterSqlite3 from "better-sqlite3";
import type { Briefing, Classification, DupCoverage, FeedItem, RawItem, RecentItem, Tier } from "./types";
import { canonicalUrl, clampFuture, normalizeTitle, sha256, arrangeFeed, type RunStats, type UnclassifiedRow } from "./db-shared";

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
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS briefings (
      date_kst TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS reactions (
      item_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (item_id, kind)
    );
  `);
  for (const ddl of [
    `ALTER TABLE items ADD COLUMN dup_of INTEGER`,
    `ALTER TABLE items ADD COLUMN summary_ko TEXT`,
    `ALTER TABLE items ADD COLUMN is_tip INTEGER NOT NULL DEFAULT 0`,
  ]) {
    try {
      db.exec(ddl);
    } catch {
      // column already exists
    }
  }
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
        publishedAt: clampFuture(r.publishedAt),
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
      `SELECT id, source_id, url, title_orig, excerpt, published_at
       FROM items WHERE status = 'new' ORDER BY published_at DESC LIMIT ?`
    )
    .all(limit) as UnclassifiedRow[];
}

export async function applyClassification(id: number, c: Classification): Promise<void> {
  const d = await getDb();
  const status = c.action === "publish" ? "published" : c.action === "duplicate" ? "duplicate" : "skipped";
  d.prepare(
    `UPDATE items SET status = @status, tier = @tier, headline_ko = @headline,
     why_ko = @why, dup_of = @dupOf, is_tip = @isTip, classified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = @id`
  ).run({
    id,
    status,
    tier: c.tier,
    headline: c.headline_ko || null,
    why: c.why_ko || null,
    dupOf: c.action === "duplicate" ? (c.duplicate_of ?? null) : null,
    isTip: c.action === "publish" && c.is_tip ? 1 : 0,
  });
}

/** delta is +1 (react) or -1 (un-react); count never goes below 0. */
export async function addReaction(itemId: number, kind: string, delta: 1 | -1): Promise<void> {
  const d = await getDb();
  d.prepare(
    `INSERT INTO reactions (item_id, kind, count) VALUES (@id, @kind, MAX(@delta, 0))
     ON CONFLICT (item_id, kind) DO UPDATE SET count = MAX(count + @delta, 0)`
  ).run({ id: itemId, kind, delta });
}

export async function getReactionsFor(itemIds: number[]): Promise<Map<number, Record<string, number>>> {
  const map = new Map<number, Record<string, number>>();
  if (itemIds.length === 0) return map;
  const d = await getDb();
  const rows = d
    .prepare(
      `SELECT item_id, kind, count FROM reactions
       WHERE count > 0 AND item_id IN (${itemIds.map(() => "?").join(",")})`
    )
    .all(...itemIds) as Array<{ item_id: number; kind: string; count: number }>;
  for (const r of rows) {
    const rec = map.get(r.item_id) ?? {};
    rec[r.kind] = r.count;
    map.set(r.item_id, rec);
  }
  return map;
}

export async function getRecentPublished(limit = 80): Promise<RecentItem[]> {
  const d = await getDb();
  return d
    .prepare(
      `SELECT id, source_id, title_orig, headline_ko FROM items
       WHERE status = 'published' AND published_at > datetime('now', '-3 days')
       ORDER BY published_at DESC LIMIT ?`
    )
    .all(limit) as RecentItem[];
}

export async function getDupCoverage(itemId: number): Promise<DupCoverage[]> {
  const d = await getDb();
  const rows = d
    .prepare(
      `SELECT source_id, title_orig, url FROM items
       WHERE dup_of = ? AND status = 'duplicate' ORDER BY published_at DESC LIMIT 6`
    )
    .all(itemId) as Array<{ source_id: string; title_orig: string; url: string }>;
  return rows.map((r) => ({ sourceId: r.source_id, titleOrig: r.title_orig, url: r.url }));
}

export async function getLatestPublished(excludeId: number, limit = 5): Promise<FeedItem[]> {
  const d = await getDb();
  const rows = d
    .prepare(
      `SELECT id, source_id, url, title_orig, headline_ko, why_ko, tier, published_at
       FROM items WHERE status = 'published' AND id <> ?
       ORDER BY published_at DESC LIMIT ?`
    )
    .all(excludeId, limit) as Array<{
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

export async function addFeedback(itemId: number): Promise<void> {
  const d = await getDb();
  d.prepare(`INSERT INTO feedback (item_id) VALUES (?)`).run(itemId);
}

export async function getBriefing(dateKst: string): Promise<Briefing | null> {
  const d = await getDb();
  const r = d.prepare(`SELECT date_kst, content FROM briefings WHERE date_kst = ?`).get(dateKst) as
    | { date_kst: string; content: string }
    | undefined;
  return r ? { dateKst: r.date_kst, content: r.content } : null;
}

export async function saveBriefing(dateKst: string, content: string): Promise<void> {
  const d = await getDb();
  d.prepare(`INSERT OR IGNORE INTO briefings (date_kst, content) VALUES (?, ?)`).run(dateKst, content);
}

export async function getTopForBriefing(limit = 12): Promise<Array<{ headline_ko: string; why_ko: string; tier: Tier }>> {
  const d = await getDb();
  return d
    .prepare(
      `SELECT headline_ko, why_ko, tier FROM items
       WHERE status = 'published' AND classified_at > datetime('now', '-24 hours')
       ORDER BY CASE tier WHEN '속보' THEN 0 WHEN '중요' THEN 1 ELSE 2 END, published_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{ headline_ko: string; why_ko: string; tier: Tier }>;
}

export async function getItem(id: number): Promise<FeedItem | null> {
  const d = await getDb();
  const r = d
    .prepare(
      `SELECT id, source_id, url, title_orig, headline_ko, why_ko, tier, published_at, summary_ko, is_tip
       FROM items WHERE id = ? AND status = 'published'`
    )
    .get(id) as
    | { id: number; source_id: string; url: string; title_orig: string; headline_ko: string; why_ko: string; tier: Tier; published_at: string; summary_ko: string | null; is_tip: number }
    | undefined;
  if (!r) return null;
  return {
    id: r.id,
    sourceId: r.source_id,
    sourceName: r.source_id,
    url: r.url,
    titleOrig: r.title_orig,
    headlineKo: r.headline_ko,
    whyKo: r.why_ko,
    tier: r.tier,
    publishedAt: r.published_at,
    isTip: Boolean(r.is_tip),
    summaryKo: r.summary_ko ?? null,
  };
}

export async function saveSummary(id: number, summaryKo: string): Promise<void> {
  const d = await getDb();
  d.prepare(`UPDATE items SET summary_ko = ? WHERE id = ?`).run(summaryKo, id);
}

export async function getFeed(limit = 100): Promise<FeedItem[]> {
  const d = await getDb();
  // Recency-sorted candidate pool with headroom; caps + interleaving in
  // arrangeFeed (db-shared.ts).
  const rows = d
    .prepare(
      `SELECT id, source_id, url, title_orig, headline_ko, why_ko, tier, published_at, is_tip
       FROM items WHERE status = 'published' ORDER BY published_at DESC LIMIT ?`
    )
    .all(limit * 4) as Array<{
    id: number;
    source_id: string;
    url: string;
    title_orig: string;
    headline_ko: string;
    why_ko: string;
    tier: Tier;
    published_at: string;
    is_tip: number;
  }>;
  return arrangeFeed(
    rows.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      sourceName: r.source_id,
      url: r.url,
      titleOrig: r.title_orig,
      headlineKo: r.headline_ko,
      whyKo: r.why_ko,
      tier: r.tier,
      publishedAt: r.published_at,
      isTip: Boolean(r.is_tip),
    })),
    limit
  );
}

// Load-more pagination: strictly-older items, plain reverse-chronological.
// ISO-8601 strings compare lexicographically in the same order as time.
export async function getFeedBefore(beforeIso: string, limit = 50): Promise<FeedItem[]> {
  const d = await getDb();
  const rows = d
    .prepare(
      `SELECT id, source_id, url, title_orig, headline_ko, why_ko, tier, published_at, is_tip
       FROM items WHERE status = 'published' AND published_at < ?
       ORDER BY published_at DESC LIMIT ?`
    )
    .all(beforeIso, limit) as Array<{
    id: number;
    source_id: string;
    url: string;
    title_orig: string;
    headline_ko: string;
    why_ko: string;
    tier: Tier;
    published_at: string;
    is_tip: number;
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
    isTip: Boolean(r.is_tip),
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
