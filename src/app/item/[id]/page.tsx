import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getItem } from "@/lib/db";
import { SOURCE_NAMES } from "@/lib/sources";
import { SITE_URL, TIER_COLOR, kstDate } from "@/lib/site";
import CopyLinkButton from "@/components/CopyLinkButton";

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

  const color = TIER_COLOR[item.tier] ?? TIER_COLOR["참고"];
  const sourceName = SOURCE_NAMES[item.sourceId] ?? item.sourceId;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <Link href="/" className="font-mono-ts text-sm text-[#8b949e] hover:text-white">
        ← promppy<span className="text-[#ffb020]">_</span> 실시간 AI 뉴스
      </Link>

      <article className="mt-8 rounded-lg border border-[#161b22] bg-white/[0.02] p-6 sm:p-8" style={{ borderLeft: `3px solid ${color}` }}>
        <div className="flex items-center gap-3 font-mono-ts text-xs text-[#8b949e]">
          <span
            className="rounded border px-1.5 py-px text-[11px] font-medium"
            style={{ color, borderColor: `${color}66`, backgroundColor: `${color}22` }}
          >
            {item.tier}
          </span>
          <span>{sourceName}</span>
          <time dateTime={item.publishedAt} suppressHydrationWarning>
            {kstDate(item.publishedAt)} KST
          </time>
        </div>

        <h1 className="mt-4 text-2xl font-bold leading-snug text-[#e6edf3] sm:text-3xl">
          {item.headlineKo}
        </h1>

        <p className="mt-4 text-[15px] leading-relaxed text-[#c9d1d9]">{item.whyKo}</p>

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

        <div className="mt-6 flex items-center gap-3">
          <CopyLinkButton url={`${SITE_URL}/item/${item.id}`} />
        </div>
      </article>

      <p className="mt-8 text-center">
        <Link
          href="/"
          className="font-mono-ts text-sm text-[#ffb020] hover:underline"
        >
          더 많은 실시간 AI 뉴스 →
        </Link>
      </p>
    </main>
  );
}
