import { getFeedBefore } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { SOURCE_NAMES } from "@/lib/sources";

export const revalidate = 300;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  // Plain reverse-chronological (no display caps/interleave — readers'
  // clients sort and dedupe themselves). Never throw: this route is
  // prerendered, so a DB outage here would fail the build (see app/page.tsx).
  let items: Awaited<ReturnType<typeof getFeedBefore>> = [];
  try {
    items = await getFeedBefore(new Date().toISOString(), 50);
  } catch (e) {
    console.error("rss: item fetch failed, empty channel:", e instanceof Error ? e.message : e);
  }

  const entries = items
    .map((i) => {
      const source = SOURCE_NAMES[i.sourceId] ?? i.sourceId;
      const tags = `[${i.tier}]${i.isTip ? "[팁]" : ""}`;
      return `    <item>
      <title>${esc(`${tags} ${i.headlineKo}`)}</title>
      <link>${SITE_URL}/item/${i.id}</link>
      <guid isPermaLink="true">${SITE_URL}/item/${i.id}</guid>
      <pubDate>${new Date(i.publishedAt).toUTCString()}</pubDate>
      <description>${esc(`${i.whyKo} (출처: ${source})`)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>promppy — 실시간 AI 뉴스</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <description>한국 AI 실무자를 위한 실시간 AI 업계 뉴스. 15분마다 자동 수집, 중요도 분류·한국어 요약 제공.</description>
    <language>ko</language>
${entries}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
