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
  /** When action is "duplicate": the DB id of the already-published story it matches. */
  duplicate_of?: number | null;
  /** Practical tip/technique with a concrete reusable takeaway (팁 badge in the feed). */
  is_tip?: boolean;
  /** 1–3 slugs from the controlled vocabulary in classify.ts (future topic pages). */
  topics?: string[];
}

/** Compact recently-published context passed to the classifier for cross-language dedup. */
export interface RecentItem {
  id: number;
  source_id: string;
  title_orig: string;
  headline_ko: string;
}

/** A paid placement in the feed / item pages. One runs at a time. */
export interface Sponsor {
  id: number;
  brand: string;
  title: string;
  body: string;
  url: string;
}

export interface Briefing {
  dateKst: string; // YYYY-MM-DD in KST
  content: string;
}

/** Response shape of /api/feed and the SSR initial payload. */
export interface FeedPayload {
  items: FeedItem[];
  lastCrawlAt: string | null;
  serverNow: string;
  briefing?: Briefing | null;
  /** Null when the slot is unsold — the UI then shows the self-promo card. */
  sponsor?: Sponsor | null;
}

/** Suppressed duplicate coverage of a published story ("다른 매체 보도"). */
export interface DupCoverage {
  sourceId: string;
  titleOrig: string;
  url: string;
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
  /** Practical tip/technique — rendered as a green 팁 badge. */
  isTip?: boolean;
  /** Topic slugs (item page chips / topic pages; not carried in the feed list). */
  topics?: string[];
  /** Reaction counts by kind (only kinds with count > 0). */
  reactions?: Record<string, number>;
  /** Korean article summary (item page only — not carried in the feed list). */
  summaryKo?: string | null;
}
