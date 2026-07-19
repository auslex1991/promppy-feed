// Standalone crawl entry point — runs the full pipeline outside Next.js.
// The crawl moved off Vercel functions (it was ~$22/mo of billed memory/CPU
// there) to GitHub Actions, which is free for public repos. It writes to the
// same Neon database, so the site picks the results up via its normal ISR /
// API caching. Nothing user-facing changes.
import { existsSync, readFileSync } from "node:fs";

// Local runs read .env.local; in CI the env comes from GitHub secrets.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/.exec(line.trim());
    if (m) process.env[m[1]] ??= m[2];
  }
}

const { runCrawl } = await import("../src/lib/crawl");

const started = Date.now();
try {
  const stats = await runCrawl();
  const secs = Math.round((Date.now() - started) / 1000);
  console.log(
    `crawl finished in ${secs}s: sources ${stats.okSources}ok/${stats.failedSources}fail, ` +
      `new=${stats.newItems}, gated=${stats.gatedOut}, published=${stats.classified}, dupes=${stats.duplicates}`
  );
  for (const e of stats.errors) console.log(`  error: ${e}`);
  process.exit(0);
} catch (e) {
  console.error("crawl failed:", e instanceof Error ? e.stack : e);
  process.exit(1);
}
