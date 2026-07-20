import { after, NextRequest, NextResponse } from "next/server";
import { runCrawl } from "@/lib/crawl";
import { lastSuccessfulRun } from "@/lib/db";

export const maxDuration = 300;

// How stale the feed must get before Vercel takes over from GitHub Actions.
// Above the normal ~10-15 min cadence (plus GitHub's scheduler drift) so this
// only fires on a real outage, not on ordinary jitter.
const STALE_AFTER_MS = 35 * 60_000;

export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when the env var is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The crawl normally runs on GitHub Actions (free for public repos); running
  // it as a Vercel function cost ~$22/mo in provisioned memory. But GitHub is
  // not a dependency we control — an Actions outage once left the feed 80+ min
  // stale with nothing to fall back on. So this endpoint is a STALENESS-GATED
  // FALLBACK, not a no-op: cron-job.org keeps pinging every 15 min, and we only
  // pay for a Vercel crawl when GitHub has actually stopped delivering.
  //
  // ?force=1 bypasses the staleness check (manual run); ?wait=1 returns stats.
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!force) {
    const last = await lastSuccessfulRun();
    const ageMs = last?.finished_at ? Date.now() - new Date(last.finished_at).getTime() : Infinity;
    if (ageMs < STALE_AFTER_MS) {
      return NextResponse.json({
        status: "fresh",
        lastCrawlMinutesAgo: Math.round(ageMs / 60000),
        detail: "GitHub Actions is keeping up; no Vercel crawl needed",
      });
    }
    // Fall through: the feed is stale, so take over.
  }

  if (req.nextUrl.searchParams.get("wait") === "1") {
    const stats = await runCrawl();
    return NextResponse.json(stats);
  }

  after(async () => {
    try {
      await runCrawl();
    } catch (e) {
      console.error("crawl failed in after():", e);
    }
  });
  return NextResponse.json({ status: "crawl_started" });
}
