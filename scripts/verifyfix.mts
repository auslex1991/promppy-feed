import { Pool } from "pg";
import { summarizeArticle } from "../src/lib/classify";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const rows = (await pool.query(
  `SELECT id, source_id, title_orig, excerpt FROM items WHERE status='published' AND source_id IN ('reddit','zdnet-kr') AND summary_ko IS NULL ORDER BY published_at DESC LIMIT 5`
)).rows;
await pool.end();
for (const r of rows) {
  const s = await summarizeArticle({ sourceId: r.source_id, title: r.title_orig, text: r.excerpt || "" });
  console.log(r.source_id, "|", r.title_orig.slice(0, 40), "->", s ? `OK (${s.length} chars): ${s.slice(0,70)}...` : "STILL FAILED");
}
