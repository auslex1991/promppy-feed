import { after, NextRequest, NextResponse } from "next/server";
import { runCrawl } from "@/lib/crawl";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when the env var is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // THE CRAWL NO LONGER RUNS HERE BY DEFAULT. Executing it as a Vercel function
  // billed ~5 hrs/day of provisioned memory+CPU (~$22/mo, over half the bill),
  // so it moved to GitHub Actions (.github/workflows/crawl.yml — free for public
  // repos). This endpoint stays as a cheap no-op so any leftover external pinger
  // (cron-job.org) costs nothing instead of silently re-running the crawl here.
  //
  // ?force=1 still runs it on Vercel — kept as a manual emergency path (e.g. if
  // GitHub Actions is down); ?wait=1 additionally returns stats synchronously.
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!force) {
    return NextResponse.json({
      status: "noop",
      detail: "crawl runs on GitHub Actions (.github/workflows/crawl.yml); use ?force=1 to run here",
    });
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
