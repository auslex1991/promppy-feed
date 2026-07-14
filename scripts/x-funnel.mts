// X funnel diagnosis: fetched → gate → classify → published, last 12h.
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}
const { Pool } = await import("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const funnel = await pool.query(
  `select status, count(*)::int as n from items
   where source_id='x' and created_at > now() - interval '12 hours'
   group by status order by n desc`
);
console.log("X items last 12h by status:");
for (const r of funnel.rows) console.log(`  ${r.status}: ${r.n}`);

const recent = await pool.query(
  `select id, status, title_orig from items
   where source_id='x' and created_at > now() - interval '12 hours'
   order by id desc limit 40`
);
console.log("\nrecent X items:");
for (const r of recent.rows) console.log(`  [${r.status}] ${r.title_orig.slice(0, 100)}`);

const runs = await pool.query(
  `select count(*)::int as n from crawl_runs where started_at > now() - interval '12 hours' and finished_at is not null`
);
console.log(`\ncrawl runs finished last 12h: ${runs.rows[0].n} (expect ~48 at 15-min cadence)`);

const errs = await pool.query(
  `select errors from crawl_runs where started_at > now() - interval '12 hours' and errors <> '[]' order by id desc limit 10`
);
const xErrs = errs.rows.flatMap((r) => JSON.parse(r.errors)).filter((e: string) => /twitter|x:/i.test(e));
console.log(`x-related crawl errors: ${xErrs.length}`);
for (const e of xErrs.slice(0, 5)) console.log(`  ${e}`);
await pool.end();
