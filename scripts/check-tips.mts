// Post-deploy check: crawl health + first is_tip-tagged items.
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}
const { Pool } = await import("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const runs = await pool.query(
  `select id, finished_at, new_items, classified, errors from crawl_runs order by id desc limit 3`
);
for (const r of runs.rows) {
  const errs = JSON.parse(r.errors ?? "[]");
  console.log(
    `run ${r.id} ${r.finished_at ? "FINISHED" : "unfinished"} | new=${r.new_items} cls=${r.classified} err=${errs.length}`
  );
  for (const e of errs.slice(0, 4)) console.log(`  err: ${e}`);
}

const tips = await pool.query(
  `select id, source_id, headline_ko, tier from items where is_tip = true order by id desc limit 10`
);
console.log(`tip-tagged items: ${tips.rowCount}`);
for (const t of tips.rows) console.log(`  #${t.id} [${t.tier}/팁] ${t.source_id} ${t.headline_ko}`);

const x = await pool.query(
  `select count(*)::int as n from items where source_id='x' and status='published' and created_at > now() - interval '3 hours'`
);
console.log(`X published last 3h: ${x.rows[0].n}`);
await pool.end();
