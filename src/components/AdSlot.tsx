"use client";

import { useEffect, useRef } from "react";

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * A single AdSense unit.
 *
 * Renders NOTHING until both NEXT_PUBLIC_ADSENSE_CLIENT and a slot id are set,
 * so the site stays clean while the AdSense account is still under review —
 * shipping this ahead of approval costs nothing and means the day approval
 * lands, revenue starts with an env var rather than a deploy.
 */
export default function AdSlot({
  slot,
  className = "",
  minHeight = 280,
}: {
  slot?: string;
  className?: string;
  minHeight?: number;
}) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!CLIENT || !slot || pushed.current) return;
    // Effects run twice under dev StrictMode, and AdSense throws
    // "All 'ins' elements already have ads in them" on a second push for the
    // same node. The ref makes the push idempotent per mount.
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blocker, or the script never loaded. Nothing to recover — the
      // reserved box just stays empty rather than throwing in the page.
    }
  }, [slot]);

  const slotId = slot?.trim();
  if (!CLIENT || !slotId) return null;

  return (
    <div className={className}>
      <p className="mb-1 font-mono-ts text-[10px] uppercase tracking-wider text-[#484f58]">광고</p>
      {/* min-height is reserved so a late-loading ad cannot shift the article
          it sits under — CLS is part of the Core Web Vitals that feed search. */}
      <ins
        className="adsbygoogle block"
        style={{ display: "block", minHeight }}
        data-ad-client={CLIENT}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
