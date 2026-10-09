"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Ticker from "@/components/Ticker";
import { TIER_COLOR } from "@/lib/site";
import { withKoreanNames } from "@/lib/brandKo";
import type { Tier } from "@/lib/types";

/**
 * Item-page blocks that must stay current while the page itself is cached
 * for 30 days. All three read one shared, CDN-cached /api/latest response.
 */

interface LatestItem {
  id: number;
  tier: Tier;
  headlineKo: string;
  whyKo: string;
  publishedAt: string;
}

const MAX_AGE_MS = 60_000;
let cache: { at: number; promise: Promise<LatestItem[]> } | null = null;

function loadLatest(): Promise<LatestItem[]> {
  // One request serves every block on the page, and client-side navigation
  // between item pages reuses it until it is a minute old.
  if (cache && Date.now() - cache.at < MAX_AGE_MS) return cache.promise;
  const promise = fetch("/api/latest")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: { items?: LatestItem[] }) => d.items ?? [])
    .catch(() => {
      // Never keep a failed load: the next block or navigation retries.
      cache = null;
      return [] as LatestItem[];
    });
  cache = { at: Date.now(), promise };
  return promise;
}

function useLatest(): LatestItem[] | null {
  const [items, setItems] = useState<LatestItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadLatest().then((x) => alive && setItems(x));
    return () => {
      alive = false;
    };
  }, []);
  return items;
}

/** Same rule the server used: the freshest item that matters, then the rest. */
function pick(items: LatestItem[], currentId: number, skipIds: number[]) {
  const skip = new Set([currentId, ...skipIds]);
  const pool = items.filter((i) => !skip.has(i.id));
  const next = pool.find((i) => i.tier === "속보" || i.tier === "중요") ?? pool[0];
  const latest = pool.filter((i) => i.id !== next?.id).slice(0, 5);
  return { next, latest };
}

function tierStyle(tier: Tier) {
  const c = TIER_COLOR[tier] ?? TIER_COLOR["참고"];
  return { color: c, borderColor: `${c}66`, backgroundColor: `${c}22` };
}

export function LiveTicker() {
  const items = useLatest();
  // Height reserved before data arrives so the article below never jumps.
  return <div className="min-h-[34px]">{items && <Ticker items={items} now={Date.now()} />}</div>;
}

export function NextNews({ currentId, skipIds }: { currentId: number; skipIds: number[] }) {
  const items = useLatest();
  const next = items ? pick(items, currentId, skipIds).next : undefined;
  if (items && !next) return null;
  if (!next) {
    return <div className="mt-6 h-[112px] rounded-lg border border-[#161b22] bg-white/[0.02]" aria-hidden />;
  }
  return (
    <Link
      href={`/item/${next.id}`}
      className="group mt-6 block rounded-lg border border-[#30363d] bg-white/[0.02] p-5 transition-colors hover:border-[#8b949e] hover:bg-white/[0.04]"
    >
      <span className="font-mono-ts text-[11px] text-[#8b949e]">다음 뉴스 →</span>
      <p className="mt-1.5 flex items-start gap-2 text-[16px] font-medium leading-snug text-[#e6edf3]">
        <span className="mt-0.5 shrink-0 rounded border px-1.5 py-px font-mono-ts text-[11px]" style={tierStyle(next.tier)}>
          {next.tier}
        </span>
        <span className="group-hover:underline">{withKoreanNames(next.headlineKo)}</span>
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#8b949e]">{withKoreanNames(next.whyKo)}</p>
    </Link>
  );
}

export function LatestNews({ currentId, skipIds }: { currentId: number; skipIds: number[] }) {
  const items = useLatest();
  if (!items) return null;
  const { latest } = pick(items, currentId, skipIds);
  if (latest.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="font-mono-ts text-xs font-semibold text-[#8b949e]">최신 뉴스</h2>
      <ul className="mt-2 space-y-1.5">
        {latest.map((l) => (
          <li key={l.id} className="text-[13px]">
            <Link href={`/item/${l.id}`} className="text-[#c9d1d9] hover:text-white hover:underline">
              <span className="mr-1.5 font-mono-ts text-[11px]" style={{ color: TIER_COLOR[l.tier] ?? TIER_COLOR["참고"] }}>
                [{l.tier}]
              </span>
              {withKoreanNames(l.headlineKo)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
