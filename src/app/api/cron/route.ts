import { after, NextRequest, NextResponse } from "next/server";
import { runCrawl } from "@/lib/crawl";
import { lastSuccessfulRun } from "@/lib/db";

export const maxDuration = 300;

// Crawl cadence. cron-job.org pings this endpoint every ~15 min; we dispatch a
// GitHub Actions run when the feed is older than this. Below the ping interval
// so every ping that finds stale data acts.
const DISPATCH_AFTER_MS = 12 * 60_000;

// Only if GitHub has clearly stopped delivering do we pay to crawl on Vercel.
// Well above the dispatch threshold so a merely-slow Actions run doesn't
// trigger a duplicate (and billed) crawl here.
const VERCEL_FALLBACK_AFTER_MS = 40 * 60_000;

const GH_REPO = "auslex1991/promppy-feed";
const GH_WORKFLOW = "crawl.yml";

/**
 * Ask GitHub Actions to run the crawl. workflow_dispatch runs start promptly,
 * unlike `schedule` runs, which GitHub throttles hard on public repos — we
 * measured real gaps of 57-157 min against a ten-minute cron, which is why a
 * schedule alone could not hold a 15-minute cadence.
 */
async function dispatchGitHubCrawl(): Promise<{ ok: boolean; status: number; detail?: string }> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { ok: false, status: 0, detail: "GITHUB_DISPATCH_TOKEN not set" };
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
        signal: AbortSignal.timeout(10000),
      }
    );
    // 204 No Content = accepted.
    return { ok: res.status === 204, status: res.status, detail: res.ok ? undefined : await res.text() };
  } catch (e) {
    return { ok: false, status: 0, detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // This endpoint is the crawl's TRIGGER, not its host. The crawl itself runs
  // on GitHub Actions (free for public repos); executing it as a Vercel
  // function cost ~$22/mo in provisioned memory. Vercel only runs the crawl
  // itself as a last resort, when GitHub is unreachable — an Actions outage
  // once left the feed 80+ min stale with nothing to take over.
  //
  // ?force=1 crawls here immediately (manual); ?wait=1 returns stats.
  const force = req.nextUrl.searchParams.get("force") === "1";

  if (!force) {
    const last = await lastSuccessfulRun();
    const ageMs = last?.finished_at ? Date.now() - new Date(last.finished_at).getTime() : Infinity;
    const minutesAgo = Number.isFinite(ageMs) ? Math.round(ageMs / 60000) : null;

    if (ageMs < DISPATCH_AFTER_MS) {
      return NextResponse.json({ status: "fresh", lastCrawlMinutesAgo: minutesAgo });
    }

    const dispatch = await dispatchGitHubCrawl();
    if (dispatch.ok) {
      return NextResponse.json({
        status: "dispatched",
        lastCrawlMinutesAgo: minutesAgo,
        detail: "GitHub Actions crawl triggered",
      });
    }

    // GitHub refused or is down. Only spend Vercel compute once the feed is
    // genuinely stale; otherwise report and wait for the next ping.
    if (ageMs < VERCEL_FALLBACK_AFTER_MS) {
      return NextResponse.json(
        {
          status: "dispatch_failed",
          lastCrawlMinutesAgo: minutesAgo,
          githubStatus: dispatch.status,
          detail: dispatch.detail?.slice(0, 200),
        },
        { status: 200 }
      );
    }
    console.error(`cron: GitHub dispatch failed (${dispatch.status}), crawling on Vercel as fallback`);
    // Fall through to the Vercel crawl.
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
  return NextResponse.json({ status: "crawl_started_on_vercel" });
}
