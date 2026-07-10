import type { Tier } from "./types";

// Canonical origin for absolute URLs (OG tags, share links).
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://promppy.com";

export const TIER_COLOR: Record<Tier, string> = {
  속보: "#ff4d4f",
  중요: "#ffb020",
  참고: "#8b949e",
};

export function kstDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
