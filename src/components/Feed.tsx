"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { FeedItem, FeedPayload, Tier } from "@/lib/types";
import CopyLinkButton from "./CopyLinkButton";
import FeedbackButton from "./FeedbackButton";

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

function kstDateKey(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function dateLabel(iso: string, now: number): string {
  const key = kstDateKey(iso);
  if (key === kstDateKey(new Date(now).toISOString())) return "오늘";
  if (key === kstDateKey(new Date(now - 86_400_000).toISOString())) return "어제";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));
}

function relative(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

type Filter = "all" | Tier;
const FILTERS: Filter[] = ["all", "속보", "중요", "참고"];
const FILTER_LABEL: Record<Filter, string> = {
  all: "전체",
  속보: "속보",
  중요: "중요",
  참고: "참고",
};

export default function Feed({ initialData }: { initialData?: FeedPayload }) {
  const [data, setData] = useState<FeedPayload | null>(initialData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState(() => Date.now());
  const knownIds = useRef<Set<number>>(new Set(initialData?.items.map((i) => i.id) ?? []));
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const firstLoad = useRef(!initialData);
  const [older, setOlder] = useState<FeedItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // New items found while the reader is scrolled down are held here and
  // surfaced via a pill instead of shifting the list under them.
  const pendingRef = useRef<FeedPayload | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [cursor, setCursor] = useState(-1); // keyboard-nav row index
  // "여기까지 읽음": timestamp of the previous visit (localStorage), set once.
  const [prevVisit, setPrevVisit] = useState<string | null>(null);

  useEffect(() => {
    try {
      const KEY = "promppy:lastVisit";
      const prev = localStorage.getItem(KEY);
      // Only treat visits >10 min apart as a "return" — reloads don't count.
      if (prev && Date.now() - new Date(prev).getTime() > 10 * 60_000) setPrevVisit(prev);
      localStorage.setItem(KEY, new Date().toISOString());
    } catch {
      // storage unavailable (private mode) — feature silently off
    }
  }, []);

  const applyPayload = useCallback((payload: FeedPayload, flashIds: number[]) => {
    payload.items.forEach((i) => knownIds.current.add(i.id));
    if (flashIds.length) setNewIds(new Set(flashIds));
    setData(payload);
    setError(null);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as FeedPayload;
      const fresh = payload.items.filter((i) => !knownIds.current.has(i.id)).map((i) => i.id);
      if (firstLoad.current) {
        firstLoad.current = false;
        applyPayload(payload, []);
      } else if (fresh.length === 0 || window.scrollY < 150) {
        // At (or near) the top: merge live, with the arrival flash.
        pendingRef.current = null;
        setPendingCount(0);
        applyPayload(payload, fresh);
      } else {
        // Reader is mid-feed: hold the update behind the pill.
        pendingRef.current = payload;
        setPendingCount(fresh.length);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [applyPayload]);

  const revealPending = useCallback(() => {
    const payload = pendingRef.current;
    if (!payload) return;
    const fresh = payload.items.filter((i) => !knownIds.current.has(i.id)).map((i) => i.id);
    pendingRef.current = null;
    setPendingCount(0);
    applyPayload(payload, fresh);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [applyPayload]);

  const loadMore = useCallback(async () => {
    const loaded = [...(data?.items ?? []), ...older];
    if (loaded.length === 0) return;
    const cursorIso = loaded.reduce((m, i) => (i.publishedAt < m ? i.publishedAt : m), loaded[0].publishedAt);
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/feed?before=${encodeURIComponent(cursorIso)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as { items: FeedItem[]; hasMore: boolean };
      const seen = new Set([...(data?.items ?? []).map((i) => i.id), ...older.map((i) => i.id)]);
      const fresh = payload.items.filter((i) => !seen.has(i.id));
      fresh.forEach((i) => knownIds.current.add(i.id));
      setOlder((prev) => [...prev, ...fresh]);
      setHasMore(payload.hasMore);
    } catch {
      // leave the button in place so the user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [data, older]);

  useEffect(() => {
    if (firstLoad.current) load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 10_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const lastCrawl = data?.lastCrawlAt ? new Date(data.lastCrawlAt).getTime() : null;
  const isLive = lastCrawl !== null && now - lastCrawl < STALE_MS;

  const items = data?.items ?? [];
  const counts: Record<Filter, number> = {
    all: items.length,
    속보: items.filter((i) => i.tier === "속보").length,
    중요: items.filter((i) => i.tier === "중요").length,
    참고: items.filter((i) => i.tier === "참고").length,
  };
  const shown = filter === "all" ? items : items.filter((i) => i.tier === filter);

  // Older (load-more) items, deduped against the front page, then tier-filtered.
  const frontIds = new Set(items.map((i) => i.id));
  const olderShown = older
    .filter((o) => !frontIds.has(o.id))
    .filter((i) => filter === "all" || i.tier === filter);
  const combined = [...shown, ...olderShown];

  // Keyboard navigation: j/k move, Enter expands, o opens the original.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        setCursor((c) => {
          const next = e.key === "j" ? Math.min(c + 1, combined.length - 1) : Math.max(c - 1, 0);
          const el = document.getElementById(`item-${combined[next]?.id}`);
          el?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (e.key === "Enter" && cursor >= 0 && combined[cursor]) {
        setExpanded((x) => (x === combined[cursor].id ? null : combined[cursor].id));
      } else if (e.key === "o" && cursor >= 0 && combined[cursor]) {
        window.open(combined[cursor].url, "_blank", "noopener");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combined, cursor]);

  const seenDates = new Set<string>();
  // Read-marker goes before the first item older than the previous visit
  // (only meaningful if at least one newer item exists above it).
  const readMarkerIdx = prevVisit ? combined.findIndex((i) => i.publishedAt <= prevVisit) : -1;
  const briefing = data?.briefing;

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-6">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#161b22] bg-[#0a0e14]/95 py-3 backdrop-blur">
        <h1 className="shrink font-mono-ts text-lg font-bold tracking-tight text-white">
          promppy<span className="text-[#ffb020]">_</span>
          <span className="ml-2 whitespace-nowrap text-xs font-normal text-[#8b949e]">
            실시간 AI 뉴스
          </span>
        </h1>
        <div className="flex shrink-0 items-center gap-2 font-mono-ts text-xs">
          {!data && !error ? (
            // Initial load — neutral, not the amber "지연" (which means stale).
            <>
              <span className="live-dot inline-block h-2 w-2 rounded-full bg-[#8b949e]" />
              <span className="text-[#8b949e]">연결 중</span>
            </>
          ) : (
            <>
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isLive ? "live-dot bg-[#3fb950]" : "bg-[#ffb020]"
                }`}
              />
              <span className={isLive ? "text-[#3fb950]" : "text-[#ffb020]"} suppressHydrationWarning>
                {isLive ? "LIVE" : "지연"}
              </span>
              {lastCrawl && (
                <span className="text-[#8b949e]" suppressHydrationWarning>
                  {relative(data!.lastCrawlAt!, now)}
                  <span className="hidden sm:inline"> 업데이트</span>
                </span>
              )}
            </>
          )}
        </div>
      </header>

      <nav
        aria-label="중요도 필터"
        className="sticky top-[49px] z-10 flex gap-1 border-b border-[#161b22] bg-[#0a0e14]/95 py-2 backdrop-blur"
      >
        {FILTERS.map((f) => {
          const active = filter === f;
          const accent =
            f === "속보" ? "#ff4d4f" : f === "중요" ? "#ffb020" : f === "참고" ? "#8b949e" : "#e6edf3";
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 font-mono-ts text-xs transition-colors ${
                active ? "bg-white/10 text-white" : "text-[#8b949e] hover:bg-white/[0.04] hover:text-[#c9d1d9]"
              }`}
              style={active ? { boxShadow: `inset 0 -2px 0 ${accent}` } : undefined}
            >
              {FILTER_LABEL[f]}
              <span className="ml-1.5 text-[#8b949e]/70">{counts[f]}</span>
            </button>
          );
        })}
      </nav>

      {pendingCount > 0 && (
        <button
          onClick={revealPending}
          aria-label={`새 뉴스 ${pendingCount}건 보기`}
          className="fixed left-1/2 top-24 z-20 -translate-x-1/2 rounded-full border border-[#ffb020]/50 bg-[#0a0e14] px-4 py-1.5 font-mono-ts text-xs text-[#ffb020] shadow-lg transition-colors hover:bg-[#ffb020]/10"
        >
          새 뉴스 {pendingCount}건 ↑
        </button>
      )}

      {!data && !error && (
        <ol aria-hidden className="animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="border-b border-[#161b22] border-l-2 border-l-[#161b22] px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="h-3 w-16 rounded bg-[#161b22]" />
                <div className="h-4 w-10 rounded bg-[#161b22]" />
                <div className="h-4 rounded bg-[#161b22]" style={{ width: `${45 + ((i * 7) % 35)}%` }} />
              </div>
              <div className="mt-2 h-3 w-2/3 rounded bg-[#161b22] sm:ml-[76px]" />
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p className="py-4 font-mono-ts text-sm text-[#ff4d4f]">피드 로딩 실패: {error}</p>
      )}

      {data && data.items.length === 0 && !error && (
        <p className="py-12 text-center text-sm text-[#8b949e]">
          아직 수집된 뉴스가 없습니다. 크롤러가 곧 첫 데이터를 가져옵니다.
        </p>
      )}

      {data && data.items.length > 0 && combined.length === 0 && (
        <p className="py-12 text-center text-sm text-[#8b949e]">
          현재 <span className="text-[#c9d1d9]">{FILTER_LABEL[filter]}</span> 등급 뉴스가 없습니다.
        </p>
      )}

      {briefing && (
        <section className="mt-3 rounded border border-[#ffb020]/25 bg-[#ffb020]/[0.04] px-4 py-3">
          <h2 className="font-mono-ts text-xs font-semibold text-[#ffb020]">
            ☀ 오늘의 브리핑 <span className="font-normal text-[#8b949e]">{briefing.dateKst}</span>
          </h2>
          <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#c9d1d9]">
            {briefing.content.split("\n").filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </section>
      )}

      <ol>
        {combined.map((item, idx) => {
          const style = TIER_STYLE[item.tier] ?? TIER_STYLE["참고"];
          const isExpanded = expanded === item.id;
          const dateKey = kstDateKey(item.publishedAt);
          let separator: string | null = null;
          if (!seenDates.has(dateKey)) {
            seenDates.add(dateKey);
            separator = dateLabel(item.publishedAt, now);
          }
          return (
            <Fragment key={item.id}>
              {idx === readMarkerIdx && idx > 0 && (
                <li
                  aria-hidden
                  className="border-b border-[#3fb950]/20 bg-[#3fb950]/[0.04] px-3 py-1 text-center font-mono-ts text-[10px] text-[#3fb950]/70"
                >
                  ── 여기까지 읽음 ──
                </li>
              )}
              {separator && (
                <li
                  aria-hidden
                  className="border-b border-[#161b22] px-3 py-1.5 font-mono-ts text-[11px] text-[#8b949e]/60"
                  suppressHydrationWarning
                >
                  ── {separator}
                </li>
              )}
              <li
                id={`item-${item.id}`}
                className={`cursor-pointer border-b border-[#161b22] border-l-2 ${style.accent} ${
                  newIds.has(item.id) ? "item-new" : ""
                } ${idx === cursor ? "bg-white/[0.05]" : ""} px-3 py-2.5 transition-colors hover:bg-white/[0.03]`}
                onClick={() => setExpanded(isExpanded ? null : item.id)}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <time
                    className="font-mono-ts text-xs text-[#8b949e]"
                    title={kstFull(item.publishedAt)}
                    dateTime={item.publishedAt}
                    suppressHydrationWarning
                  >
                    {kstTime(item.publishedAt)}
                  </time>
                  <span
                    className={`rounded border px-1.5 py-px font-mono-ts text-[11px] font-medium ${style.badge}`}
                  >
                    {item.tier}
                  </span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-0 flex-1 basis-full text-[15px] font-medium leading-snug text-[#e6edf3] hover:underline sm:basis-auto"
                  >
                    {item.headlineKo}
                  </a>
                  <span className="ml-auto min-w-0 shrink truncate font-mono-ts text-[11px] text-[#8b949e]/70">
                    {item.sourceName} ·{" "}
                    <span suppressHydrationWarning>{relative(item.publishedAt, now)}</span>
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
                      <span className="ml-auto">
                        <FeedbackButton itemId={item.id} />
                      </span>
                    </div>
                  </div>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>

      {data && data.items.length > 0 && hasMore && (
        <div className="py-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded border border-[#30363d] px-5 py-2 font-mono-ts text-xs text-[#c9d1d9] transition-colors hover:border-[#8b949e] hover:text-white disabled:opacity-50"
          >
            {loadingMore ? "불러오는 중…" : "더 보기 ↓"}
          </button>
        </div>
      )}

      <footer className="py-6 text-center font-mono-ts text-[11px] text-[#8b949e]/50">
        <p>1시간마다 자동 수집 · 요약은 AI가 생성하며 부정확할 수 있습니다</p>
        <p className="mt-1 hidden sm:block text-[10px] text-[#8b949e]/40">
          단축키: j/k 이동 · Enter 펼치기 · o 원문 열기
        </p>
        <p className="mt-2">
          <a href="/about" className="hover:text-[#8b949e] hover:underline">
            소개
          </a>
          <span className="mx-2">·</span>
          <a href="/terms" className="hover:text-[#8b949e] hover:underline">
            이용약관
          </a>
          <span className="mx-2">·</span>
          <a href="/privacy" className="hover:text-[#8b949e] hover:underline">
            개인정보 처리방침
          </a>
        </p>
      </footer>
    </div>
  );
}
