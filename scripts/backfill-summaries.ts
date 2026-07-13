/**
 * One-off: generate summary_ko for recent published items that lack one.
 *   DATABASE_URL=... GEMINI_API_KEY=... npx tsx scripts/backfill-summaries.ts [limit]
 */
import { Pool } from "pg";
import { summarizeArticle } from "../src/lib/classify";
import { fetchArticleText } from "../src/lib/adapters/article";

const limit = Number(process.argv[2] ?? 60);

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const rows = (
    await pool.query(
      `SELECT id, source_id, url, title_orig, excerpt FROM items
       WHERE status = 'published' AND summary_ko IS NULL
       ORDER BY published_at DESC LIMIT $1`,
      [limit]
    )
  ).rows;
  console.log(`backfilling summaries for ${rows.length} items…`);
  let ok = 0,
    skipped = 0;
  for (const r of rows) {
    let text: string = r.excerpt ?? "";
    if (text.trim().length < 400 && r.source_id !== "x" && r.source_id !== "reddit") {
      const article = await fetchArticleText(r.url);
      if (article.length > text.trim().length) text = article;
    }
    const summary = await summarizeArticle({ sourceId: r.source_id, title: r.title_orig, text });
    if (summary) {
      await pool.query(`UPDATE items SET summary_ko = $1 WHERE id = $2`, [summary, r.id]);
      ok++;
    } else {
      skipped++; // too little text to summarize honestly
    }
  }
  console.log(`done — summarized ${ok}, skipped (insufficient text) ${skipped}`);
  await pool.end();
}

main();
