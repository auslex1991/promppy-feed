import { after, NextRequest, NextResponse } from "next/server";
import { runCrawl } from "@/lib/crawl";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when the env var is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The full crawl (fetch 25 sources + classify with Claude) can run 30–90s —
  // longer than short-timeout cron pingers (cron-job.org ~30s) will wait.
  // Default: respond instantly and run the crawl after the response via after(),
  // which keeps the function alive up to maxDuration. Items left unclassified if
  // the function is cut short are retried on the next run (getUnclassified).
  // ?wait=1 runs synchronously and returns stats — for manual/CLI verification.
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
