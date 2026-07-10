"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedItem, Tier } from "@/lib/types";
import CopyLinkButton from "./CopyLinkButton";

const POLL_MS = 45_000;
// Crawl cadence is hourly (cron-job.org); allow 1.5 intervals + buffer before
// the LIVE indicator degrades, so a healthy hourly schedule never shows 지연.
const STALE_MS = 95 * 60_000;

const TIER_STYLE: Record<Tier, { badge: string; accent: string }> = {
  속보: { badge: "bg-[#ff4d4f]/15 text-[#ff4d4f] border-[#ff4d4f]/40", accent: "border-l-[#ff4d4f]" },
  중요: { badge: "bg-[#ffb020]/15 text-[#ffb020] border-[#ffb020]/40", accent: "border-l-[#ffb020]" },
  참고: { badge: "bg-[#8b949e]/10 text-[#8b949e] border-[#8b949e]/30", accent: "border-l-[#30363d]" },
};

function kstTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function kstFull(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(iso));
}

function relative(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

interface FeedPayload {
  items: FeedItem[];
  lastCrawlAt: string | null;
  serverNow: string;
}

export default function Feed() {
  const [data, setData] = useState<FeedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const knownIds = useRef<Set<number>>(new Set());
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as FeedPayload;
      if (!firstLoad.current) {
        const fresh = payload.items.filter((i) => !knownIds.current.has(i.id)).map((i) => i.id);
        if (fresh.length) setNewIds(new Set(fresh));
      }
      payload.items.forEach((i) => knownIds.current.add(i.id));
      firstLoad.current = false;
      setData(payload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 10_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const lastCrawl = data?.lastCrawlAt ? new Date(data.lastCrawlAt).getTime() : null;
  const isLive = lastCrawl !== null && now - lastCrawl < STALE_MS;

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-6">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#161b22] bg-[#0a0e14]/95 py-3 backdrop-blur">
        <h1 className="shrink font-mono-ts text-lg font-bold tracking-tight text-white">
          promppy<span className="text-[#ffb020]">_</span>
          <span className="ml-2 hidden text-xs font-normal text-[#8b949e] sm:inline">
            실시간 AI 뉴스
          </span>
        </h1>
        <div className="flex shrink-0 items-center gap-2 font-mono-ts text-xs">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isLive ? "live-dot bg-[#3fb950]" : "bg-[#ffb020]"
            }`}
          />
          <span className={isLive ? "text-[#3fb950]" : "text-[#ffb020]"}>
            {isLive ? "LIVE" : "지연"}
          </span>
          {lastCrawl && (
            <span className="text-[#8b949e]" suppressHydrationWarning>
              {relative(data!.lastCrawlAt!, now)}
              <span className="hidden sm:inline"> 업데이트</span>
            </span>
          )}
        </div>
      </header>

      {error && (
        <p className="py-4 font-mono-ts text-sm text-[#ff4d4f]">피드 로딩 실패: {error}</p>
      )}

      {data && data.items.length === 0 && !error && (
        <p className="py-12 text-center text-sm text-[#8b949e]">
          아직 수집된 뉴스가 없습니다. 크롤러가 곧 첫 데이터를 가져옵니다.
        </p>
      )}

      <ol>
        {data?.items.map((item) => {
          const style = TIER_STYLE[item.tier] ?? TIER_STYLE["참고"];
          const isExpanded = expanded === item.id;
          return (
            <li
              key={item.id}
              className={`cursor-pointer border-b border-[#161b22] border-l-2 ${style.accent} ${
                newIds.has(item.id) ? "item-new" : ""
              } px-3 py-2.5 transition-colors hover:bg-white/[0.03]`}
              onClick={() => setExpanded(isExpanded ? null : item.id)}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <time
                  className="font-mono-ts text-xs text-[#8b949e]"
                  title={kstFull(item.publishedAt)}
                  suppressHydrationWarning
                >
                  {kstTime(item.publishedAt)}
                </time>
                <span
                  className={`rounded border px-1.5 py-px font-mono-ts text-[11px] font-medium ${style.badge}`}
                >
                  {item.tier}
                </span>
                <span className="min-w-0 flex-1 basis-full text-[15px] font-medium leading-snug text-[#e6edf3] sm:basis-auto">
                  {item.headlineKo}
                </span>
                <span className="ml-auto min-w-0 shrink truncate font-mono-ts text-[11px] text-[#8b949e]/70">
                  {item.sourceName} · <span suppressHydrationWarning>{relative(item.publishedAt, now)}</span>
                </span>
              </div>
              <p className="mt-1 pl-0 text-[13px] leading-relaxed text-[#8b949e] sm:pl-[76px]">
                {item.whyKo}
              </p>
              {isExpanded && (
                <div className="mt-2 rounded bg-white/[0.03] p-3 text-[13px] sm:ml-[76px]">
                  <p className="text-[#8b949e]">
                    <span className="font-mono-ts text-[11px] text-[#8b949e]/60">원문 제목 </span>
                    {item.titleOrig}
                  </p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 inline-block break-all font-mono-ts text-[12px] text-[#58a6ff] hover:underline"
                  >
                    {item.url} ↗
                  </a>
                  <div className="mt-3 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <CopyLinkButton url={`${window.location.origin}/item/${item.id}`} />
                    <a
                      href={`/item/${item.id}`}
                      className="font-mono-ts text-[12px] text-[#8b949e] hover:text-white hover:underline"
                    >
                      상세 페이지 →
                    </a>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <footer className="py-6 text-center font-mono-ts text-[11px] text-[#8b949e]/50">
        15분마다 자동 수집 · 요약은 AI가 생성하며 부정확할 수 있습니다
      </footer>
    </div>
  );
}
