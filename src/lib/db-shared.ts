import { createHash } from "crypto";

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Canonicalize URL for dedup: strip tracking params, trailing slash. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const junk = [...u.searchParams.keys()].filter(
      (k) => k.startsWith("utm_") || ["ref", "source", "fbclid", "gclid"].includes(k)
    );
    junk.forEach((k) => u.searchParams.delete(k));
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw;
  }
}

export function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * Safety net for source clock skew / timezone misparses: a published_at in
 * the future would pin the item to the top of the recency-sorted feed until
 * real time catches up. Clamp to now (5-min tolerance for minor skew).
 */
export function clampFuture(iso: string | null): string {
  const now = Date.now();
  if (!iso) return new Date(now).toISOString();
  const t = new Date(iso).getTime();
  if (isNaN(t) || t > now + 5 * 60_000) return new Date(now).toISOString();
  return iso;
}

// Display-share caps: no source may occupy more slots than its cap in the
// rendered feed, independent of publish rate. Reddit gets ~20% by request;
// everything else 10%. X is UNCAPPED by user request (2026-07-14) — its only
// fairness constraint is the per-account X_AUTHOR_CAP below.
export const SOURCE_CAPS: { default: number; perSource: Record<string, number> } = {
  default: 10,
  perSource: { reddit: 20, x: Number.MAX_SAFE_INTEGER },
};

// Within the X allotment, no single ACCOUNT may hold more than this many
// front-page slots — high-volume thread-aggregator accounts (e.g. a packager
// posting 8 decent threads/day) individually pass the rubric but would
// otherwise crowd out every other curated voice.
export const X_AUTHOR_CAP = 2;

function xAuthor(titleOrig: string): string | null {
  return /^@([A-Za-z0-9_]+):/.exec(titleOrig)?.[1]?.toLowerCase() ?? null;
}

/**
 * Turn a recency-sorted candidate list into the displayed feed:
 * 1. enforce per-source caps (SOURCE_CAPS) and per-X-account caps (X_AUTHOR_CAP)
 * 2. interleave so the same source never appears back-to-back when an
 *    alternative exists within the next LOOKAHEAD items — breaks up the
 *    "N AI타임스 rows in a row" bursts while staying approximately
 *    recency-ordered (an item can be displaced by at most LOOKAHEAD slots).
 */
export function arrangeFeed<T extends { sourceId: string; titleOrig: string }>(rows: T[], limit: number): T[] {
  const counts: Record<string, number> = {};
  const authorCounts: Record<string, number> = {};
  const capped: T[] = [];
  for (const r of rows) {
    if (capped.length >= limit) break;
    const cap = SOURCE_CAPS.perSource[r.sourceId] ?? SOURCE_CAPS.default;
    const c = counts[r.sourceId] ?? 0;
    if (c >= cap) continue;
    if (r.sourceId === "x") {
      const author = xAuthor(r.titleOrig);
      if (author) {
        const ac = authorCounts[author] ?? 0;
        if (ac >= X_AUTHOR_CAP) continue;
        authorCounts[author] = ac + 1;
      }
    }
    counts[r.sourceId] = c + 1;
    capped.push(r);
  }

  const LOOKAHEAD = 8;
  const out: T[] = [];
  const pool = [...capped];
  while (pool.length > 0) {
    const prev = out[out.length - 1]?.sourceId;
    let pick = 0;
    if (prev !== undefined && pool[0].sourceId === prev) {
      const w = Math.min(LOOKAHEAD, pool.length);
      for (let i = 1; i < w; i++) {
        if (pool[i].sourceId !== prev) {
          pick = i;
          break;
        }
      }
    }
    out.push(pool.splice(pick, 1)[0]);
  }
  return out;
}

export interface UnclassifiedRow {
  id: number;
  source_id: string;
  url: string;
  title_orig: string;
  excerpt: string;
  published_at: string;
}

export interface RunStats {
  okSources: number;
  failedSources: number;
  newItems: number;
  classified: number;
  errors: string[];
}
