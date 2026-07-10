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

// No single source may occupy more than this many slots in the rendered feed.
// AI타임스 and TechCrunch are high-volume and would otherwise dominate; this
// caps display share independent of per-source publish rate.
export const PER_SOURCE_CAP = 10;

export interface UnclassifiedRow {
  id: number;
  source_id: string;
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
