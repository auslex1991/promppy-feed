import type { Metadata } from "next";
import Link from "next/link";
import { getTopicCounts } from "@/lib/db";

// Stats change slowly; regenerate a few times a day.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "광고 문의 — promppy",
  description:
    "promppy는 한국 AI 실무자가 매일 찾는 실시간 AI 뉴스 피드입니다. 피드 스폰서 슬롯과 데일리 브리핑 스폰서를 제공합니다.",
};

const CONTACT = "admin@promppy.com";

// Audience numbers are reported manually — Vercel Analytics isn't queryable at
// build time. Keep the "기준" date honest when refreshing these.
const STATS = {
  asOf: "2026년 7월",
  weeklyVisitors: "5,300+",
  weeklyPageviews: "10,000+",
  itemsPerDay: "180+",
};

export default async function AdvertisePage() {
  let topicCount = 0;
  try {
    topicCount = (await getTopicCounts(3)).length;
  } catch {
    // stats page must never fail on a DB hiccup
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="font-mono-ts text-sm text-[#8b949e] hover:text-white">
        ← promppy<span className="text-[#ffb020]">_</span> 실시간 AI 뉴스
      </Link>

      <h1 className="mt-8 text-2xl font-bold text-[#e6edf3] sm:text-3xl">광고 문의</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[#c9d1d9]">
        promppy는 한국 AI 실무자를 위한 실시간 AI 뉴스 터미널입니다. Cursor·Claude·GPT를 매일 쓰는
        개발자와 기획자가 새로운 소식을 확인하러 찾아옵니다.
      </p>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "주간 방문자", v: STATS.weeklyVisitors },
          { k: "주간 페이지뷰", v: STATS.weeklyPageviews },
          { k: "일 발행 기사", v: STATS.itemsPerDay },
          { k: "토픽 페이지", v: `${topicCount}개` },
        ].map((s) => (
          <div key={s.k} className="rounded-lg border border-[#161b22] bg-white/[0.02] p-4">
            <div className="font-mono-ts text-lg font-bold text-[#e6edf3]">{s.v}</div>
            <div className="mt-0.5 font-mono-ts text-[11px] text-[#8b949e]">{s.k}</div>
          </div>
        ))}
      </section>
      <p className="mt-2 font-mono-ts text-[11px] text-[#8b949e]/60">
        기준: {STATS.asOf} · 데이터 출처: Vercel Analytics
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#e6edf3]">독자</h2>
        <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-[#c9d1d9]">
          <li>· AI 도구를 실무에 쓰는 개발자·기획자·창업자</li>
          <li>· 모델 출시, 가격 변경, 에이전트 도구 소식을 매일 확인하는 사용자</li>
          <li>· 유입 경로: Threads, Google 검색, 커뮤니티 공유</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#e6edf3]">광고 상품</h2>

        <div className="mt-4 rounded-lg border border-[#ffb020]/25 bg-[#ffb020]/[0.04] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold text-[#e6edf3]">피드 스폰서 슬롯</h3>
            <span className="shrink-0 font-mono-ts text-sm text-[#ffb020]">월 30만원</span>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#c9d1d9]">
            메인 피드 상단 영역에 고정 노출되는 네이티브 슬롯입니다. 기사와 같은 형식이지만
            <span className="font-mono-ts text-[#ffb020]"> AD</span> 라벨이 항상 표시됩니다.
            제목 1줄 + 설명 1줄 + 링크.
          </p>
          <p className="mt-2 font-mono-ts text-[11px] text-[#8b949e]">
            동시에 1개 광고주만 노출 · 최소 1개월
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-[#161b22] bg-white/[0.02] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold text-[#e6edf3]">데일리 브리핑 스폰서</h3>
            <span className="shrink-0 font-mono-ts text-sm text-[#c9d1d9]">협의</span>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#c9d1d9]">
            매일 아침 발행되는 “오늘의 브리핑” 하단 스폰서 표기. 준비 중이며 사전 문의를 받습니다.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#e6edf3]">싣지 않는 광고</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-[#c9d1d9]">
          독자 신뢰가 이 매체의 전부입니다. 코인·도박·과장된 수익 보장, 그리고 AI 실무자와 무관한
          광고는 받지 않습니다. 기사와 광고는 언제나 명확히 구분됩니다.
        </p>
      </section>

      <section className="mt-10 rounded-lg border border-[#161b22] bg-white/[0.02] p-6 text-center">
        <h2 className="text-lg font-semibold text-[#e6edf3]">문의</h2>
        <p className="mt-2 text-[14px] text-[#c9d1d9]">
          집행 희망 시기와 소재를 함께 보내주시면 빠르게 회신드립니다.
        </p>
        <a
          href={`mailto:${CONTACT}?subject=${encodeURIComponent("promppy 광고 문의")}`}
          className="mt-4 inline-block rounded-full bg-[#ffb020] px-5 py-2 font-mono-ts text-[14px] font-medium text-[#0a0e14] transition-colors hover:bg-[#ffc247]"
        >
          {CONTACT}
        </a>
      </section>

      <p className="mt-10 text-center">
        <Link href="/" className="font-mono-ts text-sm text-[#8b949e] hover:text-white hover:underline">
          ← 실시간 피드로 돌아가기
        </Link>
      </p>
    </main>
  );
}
