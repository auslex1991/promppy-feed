"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";

/**
 * One-tap re-share of a promppy item to Threads (the site's #1 referral
 * channel). Opens Threads' compose intent prefilled with a Korean blurb, and
 * copies the same text to the clipboard as a fallback if the intent window is
 * blocked or the user is on a device without the Threads app/site.
 */
export default function ThreadsShareButton({
  headlineKo,
  whyKo,
  url,
}: {
  headlineKo: string;
  whyKo: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  const blurb = `${headlineKo}\n\n${whyKo}\n\n👉 ${url}`;
  const intent = `https://www.threads.net/intent/post?text=${encodeURIComponent(blurb)}`;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        track("threads_share");
        navigator.clipboard?.writeText(blurb).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        window.open(intent, "_blank", "noopener");
      }}
      className="font-mono-ts text-[12px] text-[#8b949e] transition-colors hover:text-[#e6edf3]"
      title="Threads에 공유 (문구 자동 복사)"
    >
      {copied ? "✓ 복사됨 · Threads 열기" : "@ Threads 공유"}
    </button>
  );
}
