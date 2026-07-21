import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getItemsByTopic } from "@/lib/db";
import { SOURCE_NAMES } from "@/lib/sources";
import { SITE_URL, TIER_COLOR } from "@/lib/site";
import { TOPIC_SLUGS, topicLabel, topicKeywords, TOPIC_LABELS } from "@/lib/topics";

// 1h: topic pages are SEO hub pages; freshness within the hour is plenty.
// ~40 possible slugs so ISR-write volume is bounded and tiny.
export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!TOPIC_SLUGS.has(slug)) return { title: "promppy — 실시간 AI 뉴스" };
  const label = topicLabel(slug);
  const title = `${label} 최신 뉴스 — promppy`;
  const description = `${label} 관련 AI 업계 소식을 실시간으로. 15분마다 자동 수집, 중요도 분류와 한국어 요약 제공.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/topic/${slug}` },
    openGraph: { title, description, url: `${SITE_URL}/topic/${slug}`, siteName: "promppy", locale: "ko_KR" },
  };
}

function kstDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  if (!TOPIC_SLUGS.has(slug)) notFound();

  const items = await getItemsByTopic(slug, topicKeywords(slug), 50);
  const label = topicLabel(slug);
  // Sibling topics for cross-navigation (static list keeps this DB-free).
  const siblings = Object.keys(TOPIC_LABELS).filter((s) => s !== slug).slice(0, 12);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="font-mono-ts text-sm text-[#8b949e] hover:text-white">
        ← promppy<span className="text-[#ffb020]">_</span> 실시간 AI 뉴스
      </Link>

      <h1 className="mt-6 text-2xl font-bold text-[#e6edf3]">
        {label} <span className="font-normal text-[#8b949e]">최신 뉴스</span>
      </h1>
      <p className="mt-1 font-mono-ts text-[12px] text-[#8b949e]">
        {label} 관련 소식 {items.length}건 · 15분마다 자동 수집
      </p>

      {items.length === 0 && (
        <p className="py-16 text-center text-sm text-[#8b949e]">
          아직 {label} 관련 뉴스가 없습니다.
        </p>
      )}

      <ol className="mt-6">
        {items.map((i) => (
          <li key={i.id} className="border-b border-[#161b22] py-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span
                className="rounded border px-1.5 py-px font-mono-ts text-[11px]"
                style={{
                  color: TIER_COLOR[i.tier] ?? TIER_COLOR["참고"],
                  borderColor: `${TIER_COLOR[i.tier] ?? TIER_COLOR["참고"]}66`,
                  backgroundColor: `${TIER_COLOR[i.tier] ?? TIER_COLOR["참고"]}22`,
                }}
              >
                {i.tier}
              </span>
              {i.isTip && (
                <span className="rounded border border-[#3fb950]/40 bg-[#3fb950]/10 px-1.5 py-px font-mono-ts text-[11px] text-[#3fb950]">
                  팁
                </span>
              )}
              <Link
                href={`/item/${i.id}`}
                className="min-w-0 flex-1 basis-full text-[15px] font-medium leading-snug text-[#e6edf3] hover:underline sm:basis-auto"
              >
                {i.headlineKo}
              </Link>
              <span className="ml-auto shrink-0 font-mono-ts text-[11px] text-[#8b949e]/70" suppressHydrationWarning>
                {SOURCE_NAMES[i.sourceId] ?? i.sourceId} · {kstDate(i.publishedAt)}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-[#8b949e]">{i.whyKo}</p>
          </li>
        ))}
      </ol>

      <section className="mt-10">
        <h2 className="font-mono-ts text-xs font-semibold text-[#8b949e]">다른 토픽</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {siblings.map((s) => (
            <Link
              key={s}
              href={`/topic/${s}`}
              className="rounded-full border border-[#30363d] px-3 py-1 font-mono-ts text-[12px] text-[#c9d1d9] transition-colors hover:border-[#8b949e] hover:text-white"
            >
              #{topicLabel(s)}
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-10 text-center">
        <Link href="/" className="font-mono-ts text-sm text-[#ffb020] hover:underline">
          실시간 피드 보기 →
        </Link>
      </p>
    </main>
  );
}
