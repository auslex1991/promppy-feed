"use client";

import { useState } from "react";

export default function FeedbackButton({ itemId }: { itemId: number }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  return (
    <button
      disabled={state !== "idle"}
      onClick={async (e) => {
        e.stopPropagation();
        setState("sending");
        try {
          await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId }),
          });
          setState("done");
        } catch {
          setState("idle");
        }
      }}
      className="font-mono-ts text-[12px] text-[#8b949e]/60 transition-colors hover:text-[#ff4d4f] disabled:cursor-default"
    >
      {state === "done" ? "✓ 제보 감사합니다" : state === "sending" ? "…" : "⚠ 요약 오류 제보"}
    </button>
  );
}
