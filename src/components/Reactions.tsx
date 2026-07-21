"use client";

import { useEffect, useState } from "react";
import { REACTION_KINDS, REACTION_LABEL, type ReactionKind } from "@/lib/reactions";

const STORE_KEY = "promppy:reactions";

function readStore(): Record<string, ReactionKind[]> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, ReactionKind[]>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // storage unavailable — reactions still send, just re-tappable
  }
}

/**
 * One-tap anonymous reactions. localStorage remembers what this browser
 * reacted to (toggle off on second tap); counts update optimistically and
 * the server tally is eventually consistent.
 */
export default function Reactions({
  itemId,
  initial,
  refetch = false,
}: {
  itemId: number;
  initial?: Record<string, number>;
  /** @deprecated no longer fetches — see the note below. Kept so callers that
   *  still pass it don't break. */
  refetch?: boolean;
}) {
  const [counts, setCounts] = useState<Record<string, number>>(initial ?? {});
  const [mine, setMine] = useState<ReactionKind[]>([]);

  useEffect(() => {
    setMine(readStore()[String(itemId)] ?? []);
    // NO per-view fetch. Item pages used to refetch live counts on mount to
    // beat the 6h ISR cache — but that was a Vercel function invocation on
    // EVERY item-page view (~85% of traffic), and with reactions this sparse
    // (~all items have 0) it dominated Observability/Function costs to fix a
    // cosmetic staleness. The ISR-baked `initial` counts are good enough; a
    // reactor still sees their own tap immediately (optimistic update below).
  }, [itemId]);

  const toggle = (kind: ReactionKind) => {
    const has = mine.includes(kind);
    const delta = has ? -1 : 1;
    const next = has ? mine.filter((k) => k !== kind) : [...mine, kind];
    setMine(next);
    setCounts((c) => ({ ...c, [kind]: Math.max((c[kind] ?? 0) + delta, 0) }));
    const store = readStore();
    store[String(itemId)] = next;
    writeStore(store);
    fetch("/api/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, kind, delta }),
    }).catch(() => {
      // network failure: keep the optimistic UI; worst case one lost tap
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      {REACTION_KINDS.map((kind) => {
        const active = mine.includes(kind);
        const n = counts[kind] ?? 0;
        return (
          <button
            key={kind}
            onClick={(e) => {
              e.stopPropagation();
              toggle(kind);
            }}
            aria-pressed={active}
            title={REACTION_LABEL[kind].label}
            className={`rounded-full border px-2 py-0.5 font-mono-ts text-[12px] transition-colors ${
              active
                ? "border-[#3fb950]/50 bg-[#3fb950]/10 text-[#3fb950]"
                : "border-[#30363d] text-[#8b949e] hover:border-[#8b949e] hover:text-[#c9d1d9]"
            }`}
          >
            {REACTION_LABEL[kind].emoji} {REACTION_LABEL[kind].label}
            {n > 0 && <span className="ml-1 text-[11px] opacity-80">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
