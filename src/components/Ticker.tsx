"use client";

import type { FeedItem } from "@/lib/types";

const MAX_ENTRIES = 12;
const WINDOW_MS = 24 * 3_600_000;

/**
 * News-wire marquee: 속보/중요 headlines from the last 24h scrolling
 * horizontally under the filter bar. Hidden when there's nothing above
 * 참고-tier — an empty strip reads as a broken one.
 */
export default function Ticker({ items, now }: { items: FeedItem[]; now: number }) {
  const entries = items
    .filter((i) => i.tier !== "참고" && now - new Date(i.publishedAt).getTime() < WINDOW_MS)
    .slice(0, MAX_ENTRIES);
  if (entries.length < 2) return null;

  // Loop speed scales with content so a short list doesn't blur past.
  const duration = Math.max(30, entries.length * 9);

  const strip = (hidden: boolean) => (
    <div className="ticker-half" aria-hidden={hidden || undefined}>
      {entries.map((item) => (
        <a
          key={item.id}
          href={`/item/${item.id}`}
          tabIndex={hidden ? -1 : undefined}
          className="ticker-entry font-mono-ts"
        >
          <span className={item.tier === "속보" ? "text-[#ff4d4f]" : "text-[#ffb020]"}>
            {item.tier === "속보" ? "● 속보" : "●"}
          </span>
          <span className="ticker-headline">{item.headlineKo}</span>
        </a>
      ))}
    </div>
  );

  return (
    <div className="ticker border-b border-[#161b22]" role="marquee" aria-label="주요 뉴스 헤드라인">
      <div className="ticker-track" style={{ animationDuration: `${duration}s` }}>
        {strip(false)}
        {strip(true)}
      </div>
    </div>
  );
}
