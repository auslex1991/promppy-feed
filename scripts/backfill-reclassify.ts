/**
 * One-off backfill: classify all `status='new'` items directly, bypassing the
 * crawler's newest-first queue (which starves old-dated items when a batch is
 * injected). Reuses the real classifyItem so there's no prompt drift.
 *
 *   DATABASE_URL=... ANTHROPIC_API_KEY=... npx tsx scripts/backfill-reclassify.ts [sourceId]
 */
import { Pool } from "pg";
import { classifyItem } from "../src/lib/classify";
import type { RecentItem } from "../src/lib/types";

const sourceFilter = process.argv[2]; // optional: only this source_id

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const pending = (
    await pool.query(
      `SELECT id, source_id, title_orig, excerpt, published_at FROM items
       WHERE status = 'new' ${sourceFilter ? "AND source_id = $1" : ""}
       ORDER BY published_at DESC`,
      sourceFilter ? [sourceFilter] : []
    )
  ).rows;

  const context: RecentItem[] = (
    await pool.query(
      `SELECT id, source_id, title_orig, headline_ko FROM items
       WHERE status = 'published' AND published_at > now() - interval '3 days'
       ORDER BY published_at DESC LIMIT 80`
    )
  ).rows;

  console.log(`backfilling ${pending.length} '${sourceFilter ?? "any"}' items…`);
  let pub = 0,
    skip = 0,
    dup = 0,
    err = 0;

  for (const p of pending) {
    try {
      const r = await classifyItem(
        {
          sourceId: p.source_id,
          title: p.title_orig,
          publishedAt: new Date(p.published_at).toISOString(),
          excerpt: p.excerpt,
        },
        context
      );
      const status = r.action === "publish" ? "published" : r.action === "duplicate" ? "duplicate" : "skipped";
      await pool.query(
        `UPDATE items SET status=$1, tier=$2, headline_ko=$3, why_ko=$4, classified_at=now() WHERE id=$5`,
        [status, r.tier, r.headline_ko || null, r.why_ko || null, p.id]
      );
      if (r.action === "publish") {
        pub++;
        context.unshift({ id: p.id, source_id: p.source_id, title_orig: p.title_orig, headline_ko: r.headline_ko });
      } else if (r.action === "duplicate") dup++;
      else skip++;
    } catch (e) {
      err++;
      console.error(`  #${p.id} failed:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`done — published ${pub}, skipped ${skip}, duplicate ${dup}, errors ${err}`);
  await pool.end();
}

main();
