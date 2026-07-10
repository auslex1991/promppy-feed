export type Tier = "속보" | "중요" | "참고";

/** Normalized shape every source adapter must produce (SOURCES.md — adapter interface). */
export interface RawItem {
  sourceId: string;
  url: string;
  title: string;
  /** ISO 8601. Null when the source exposes no date; stored as first-seen time. */
  publishedAt: string | null;
  excerpt: string;
}

export interface SourceResult {
  sourceId: string;
  ok: boolean;
  items: RawItem[];
  error?: string;
}

export interface Classification {
  action: "publish" | "skip" | "duplicate";
  tier: Tier | null;
  headline_ko: string;
  why_ko: string;
}

/** Compact recently-published context passed to the classifier for cross-language dedup. */
export interface RecentItem {
  source_id: string;
  title_orig: string;
  headline_ko: string;
}

/** Row shape served to the frontend. */
export interface FeedItem {
  id: number;
  sourceId: string;
  sourceName: string;
  url: string;
  titleOrig: string;
  headlineKo: string;
  whyKo: string;
  tier: Tier;
  publishedAt: string;
}
