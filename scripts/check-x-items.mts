// Post-deploy check: X items ingested/classified in the last 15 minutes.
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}
const { Pool } = await import("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const runs = await pool.query(
  `select id, finished_at, new_items, classified, errors from crawl_runs order by id desc limit 2`
);
for (const r of runs.rows) {
  const errs = JSON.parse(r.errors ?? "[]");
  console.log(
    `run ${r.id} ${r.finished_at ? "FINISHED" : "unfinished"} | new=${r.new_items} cls=${r.classified} err=${errs.length}`
  );
  for (const e of errs.slice(0, 6)) console.log(`  err: ${e}`);
}

const x = await pool.query(
  `select id, status, title_orig, headline_ko, tier from items
   where source_id='x' and created_at > now() - interval '15 minutes'
   order by id desc limit 30`
);
console.log(`\nX items ingested last 15 min: ${x.rowCount}`);
for (const i of x.rows) {
  console.log(`  [${i.status}${i.tier ? "/" + i.tier : ""}] ${(i.headline_ko || i.title_orig).slice(0, 90)}`);
}
await pool.end();
