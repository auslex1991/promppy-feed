import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDupCoverage, getItem, getLatestPublished, getReactionsFor } from "@/lib/db";
import { SOURCE_NAMES } from "@/lib/sources";
import { SITE_URL, TIER_COLOR, kstDate } from "@/lib/site";
import CopyLinkButton from "@/components/CopyLinkButton";
import Reactions from "@/components/Reactions";
import ThreadsShareButton from "@/components/ThreadsShareButton";
import PushToggle from "@/components/PushToggle";
import Ticker from "@/components/Ticker";
import TrackedLink from "@/components/TrackedLink";
import { pickRelated } from "@/lib/related";

// Item pages are ~85% of traffic and were server-rendered on every hit, each
// paying for live DB queries (including the 300-item relatedness pool).
// Published items barely change, so cache them: near-instant pages for the
// Threads/Google arrivals, less Neon and Vercel compute. Cost: reaction counts
// and the related/ticker lists can be up to 5 minutes stale on first paint.
export const revalidate = 300;

interface Props {
  params: Promise<{ id: string }>;
}

async function loadItem(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return null;
  return getItem(id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await loadItem(id);
  if (!item) return { title: "promppy — 실시간 AI 뉴스" };
  const title = `[${item.tier}] ${item.headlineKo}`;
  return {
    title: `${title} | promppy`,
    description: item.whyKo,
    alternates: { canonical: `${SITE_URL}/item/${item.id}` },
    openGraph: {
      title,
      description: item.whyKo,
      url: `${SITE_URL}/item/${item.id}`,
      siteName: "promppy",
      type: "article",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: item.whyKo,
    },
  };
}

export default async function ItemPage({ params }: Props) {
  const { id } = await params;
  const item = await loadItem(id);
  if (!item) notFound();

  const [dups, candidates, reactions] = await Promise.all([
    getDupCoverage(item.id),
    getLatestPublished(item.id, 300),
    getReactionsFor([item.id]),
  ]);
  const color = TIER_COLOR[item.tier] ?? TIER_COLOR["참고"];
  const sourceName = SOURCE_NAMES[item.sourceId] ?? item.sourceId;

  // One obvious next click: the freshest item that actually matters.
  const nextItem = candidates.find((c) => c.tier === "속보" || c.tier === "중요") ?? candidates[0];
  const related = pickRelated(item, candidates, 5).filter((r) => r.id !== nextItem?.id);
  const shownIds = new Set([nextItem?.id, ...related.map((r) => r.id)]);
  const latest = candidates.filter((c) => !shownIds.has(c.id)).slice(0, 5);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <Link href="/" className="font-mono-ts text-sm text-[#8b949e] hover:text-white">
        ← promppy<span className="text-[#ffb020]">_</span> 실시간 AI 뉴스
      </Link>

      {/* Live 속보/중요 strip: most visitors land here from a shared link and
          never see the homepage, so this is their only signal the feed is live. */}
      <div className="mt-4">
        <Ticker items={candidates.slice(0, 40)} now={Date.now()} />
      </div>

      <article className="mt-8 rounded-lg border border-[#161b22] bg-white/[0.02] p-6 sm:p-8" style={{ borderLeft: `3px solid ${color}` }}>
        <div className="flex items-center gap-3 font-mono-ts text-xs text-[#8b949e]">
          <span
            className="rounded border px-1.5 py-px text-[11px] font-medium"
            style={{ color, borderColor: `${color}66`, backgroundColor: `${color}22` }}
          >
            {item.tier}
          </span>
          {item.isTip && (
            <span className="rounded border border-[#3fb950]/40 bg-[#3fb950]/10 px-1.5 py-px text-[11px] font-medium text-[#3fb950]">
              팁
            </span>
          )}
          <span>{sourceName}</span>
          <time dateTime={item.publishedAt} suppressHydrationWarning>
            {kstDate(item.publishedAt)} KST
          </time>
        </div>

        <h1 className="mt-4 text-2xl font-bold leading-snug text-[#e6edf3] sm:text-3xl">
          {item.headlineKo}
        </h1>

        <p className="mt-4 text-[15px] leading-relaxed text-[#c9d1d9]">{item.whyKo}</p>

        {item.summaryKo && (
          <div className="mt-6 border-t border-[#161b22] pt-5">
            <h2 className="font-mono-ts text-xs font-semibold text-[#8b949e]">요약</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#c9d1d9]">{item.summaryKo}</p>
            <p className="mt-2 font-mono-ts text-[10px] text-[#8b949e]/50">
              AI가 원문을 요약한 내용으로, 부정확할 수 있습니다.
            </p>
          </div>
        )}

        <div className="mt-6 border-t border-[#161b22] pt-4 text-[13px] text-[#8b949e]">
          <p>
            <span className="font-mono-ts text-[11px] text-[#8b949e]/60">원문 제목 </span>
            {item.titleOrig}
          </p>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block break-all font-mono-ts text-[12px] text-[#58a6ff] hover:underline"
          >
            원문 보기 ↗
          </a>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          <Reactions itemId={item.id} initial={reactions.get(item.id)} />
          <CopyLinkButton url={`${SITE_URL}/item/${item.id}`} />
          <ThreadsShareButton headlineKo={item.headlineKo} whyKo={item.whyKo} url={`${SITE_URL}/item/${item.id}`} />
        </div>
      </article>

      {nextItem && (
        <TrackedLink
          event="next_news_click"
          href={`/item/${nextItem.id}`}
          className="group mt-6 block rounded-lg border border-[#30363d] bg-white/[0.02] p-5 transition-colors hover:border-[#8b949e] hover:bg-white/[0.04]"
        >
          <span className="font-mono-ts text-[11px] text-[#8b949e]">다음 뉴스 →</span>
          <p className="mt-1.5 flex items-start gap-2 text-[16px] font-medium leading-snug text-[#e6edf3]">
            <span
              className="mt-0.5 shrink-0 rounded border px-1.5 py-px font-mono-ts text-[11px]"
              style={{
                color: TIER_COLOR[nextItem.tier] ?? TIER_COLOR["참고"],
                borderColor: `${TIER_COLOR[nextItem.tier] ?? TIER_COLOR["참고"]}66`,
                backgroundColor: `${TIER_COLOR[nextItem.tier] ?? TIER_COLOR["참고"]}22`,
              }}
            >
              {nextItem.tier}
            </span>
            <span className="group-hover:underline">{nextItem.headlineKo}</span>
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#8b949e]">{nextItem.whyKo}</p>
        </TrackedLink>
      )}

      <section className="mt-8 rounded-lg border border-[#ffb020]/25 bg-[#ffb020]/[0.04] p-5 text-center">
        <p className="text-[15px] text-[#e6edf3]">
          <span className="font-semibold">promppy</span>는 한국 AI 실무자를 위한 실시간 AI 뉴스 터미널입니다.
        </p>
        <p className="mt-1 font-mono-ts text-[11px] text-[#8b949e]">
          15분마다 속보·중요·팁 자동 수집 · 한국어 요약 제공
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <TrackedLink
            event="cta_feed_click"
            href="/"
            className="rounded-full bg-[#ffb020] px-4 py-1.5 font-mono-ts text-[13px] font-medium text-[#0a0e14] transition-colors hover:bg-[#ffc247]"
          >
            실시간 피드 보기 →
          </TrackedLink>
          <PushToggle />
          <a
            href="/rss.xml"
            className="font-mono-ts text-[12px] text-[#8b949e] transition-colors hover:text-[#c9d1d9]"
          >
            RSS 구독
          </a>
        </div>
      </section>

      {dups.length > 0 && (
        <section className="mt-8">
          <h2 className="font-mono-ts text-xs font-semibold text-[#8b949e]">다른 매체 보도</h2>
          <ul className="mt-2 space-y-1.5">
            {dups.map((d) => (
              <li key={d.url} className="text-[13px]">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#c9d1d9] hover:text-white hover:underline"
                >
                  <span className="font-mono-ts text-[11px] text-[#8b949e]">
                    [{SOURCE_NAMES[d.sourceId] ?? d.sourceId}]
                  </span>{" "}
                  {d.titleOrig} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="font-mono-ts text-xs font-semibold text-[#8b949e]">관련 뉴스</h2>
          <ul className="mt-2 space-y-1.5">
            {related.map((r) => (
              <li key={r.id} className="text-[13px]">
                <TrackedLink
                  event="related_click"
                  href={`/item/${r.id}`}
                  className="text-[#c9d1d9] hover:text-white hover:underline"
                >
                  <span
                    className="mr-1.5 font-mono-ts text-[11px]"
                    style={{ color: TIER_COLOR[r.tier] ?? TIER_COLOR["참고"] }}
                  >
                    [{r.tier}]
                  </span>
                  {r.headlineKo}
                </TrackedLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {latest.length > 0 && (
        <section className="mt-8">
          <h2 className="font-mono-ts text-xs font-semibold text-[#8b949e]">최신 뉴스</h2>
          <ul className="mt-2 space-y-1.5">
            {latest.map((l) => (
              <li key={l.id} className="text-[13px]">
                <TrackedLink
                  event="latest_click"
                  href={`/item/${l.id}`}
                  className="text-[#c9d1d9] hover:text-white hover:underline"
                >
                  <span
                    className="mr-1.5 font-mono-ts text-[11px]"
                    style={{ color: TIER_COLOR[l.tier] ?? TIER_COLOR["참고"] }}
                  >
                    [{l.tier}]
                  </span>
                  {l.headlineKo}
                </TrackedLink>
              </li>
            ))}
          </ul>
        </section>
      )}

    </main>
  );
}
