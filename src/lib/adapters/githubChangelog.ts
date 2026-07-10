import type { RawItem } from "../types";

/**
 * Parse a Keep-a-Changelog-style markdown file into per-version items
 * (SOURCES.md #16 — Claude Code changelog). Only the newest few versions;
 * dedup drops the ones we've already seen.
 */
export async function fetchGithubChangelog(
  sourceId: string,
  rawUrl: string,
  linkBase: string,
  productName: string,
  maxVersions = 3
): Promise<RawItem[]> {
  const res = await fetch(rawUrl, {
    headers: { "User-Agent": "promppy-feed-bot/0.1" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`changelog HTTP ${res.status}`);
  const md = await res.text();
  const sections = md.split(/^## /m).slice(1, maxVersions + 1);
  return sections.map((sec) => {
    const [header, ...body] = sec.split("\n");
    const version = header.trim();
    return {
      sourceId,
      url: `${linkBase}#v${version.replace(/[^0-9a-z.-]/gi, "")}`,
      title: `${productName} ${version} released`,
      publishedAt: null, // changelog carries no dates; first-seen time is used
      excerpt: body.join("\n").trim().slice(0, 1200),
    };
  });
}
