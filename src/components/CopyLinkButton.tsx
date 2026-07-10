"use client";

import { useState } from "react";

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard unavailable (http, old browser) — show the URL instead.
          window.prompt("링크를 복사하세요:", url);
        }
      }}
      className="rounded border border-[#30363d] px-3 py-1.5 font-mono-ts text-[12px] text-[#c9d1d9] transition-colors hover:border-[#8b949e] hover:text-white"
    >
      {copied ? "✓ 복사됨" : "🔗 링크 복사"}
    </button>
  );
}
