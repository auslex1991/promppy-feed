import { ImageResponse } from "next/og";
import { getItem } from "@/lib/db";
import { SOURCE_NAMES } from "@/lib/sources";
import { TIER_COLOR } from "@/lib/site";

export const alt = "promppy — 실시간 AI 뉴스";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Korean glyphs aren't in ImageResponse's built-in font. Bundling all of Noto
 * Sans KR would be megabytes, so fetch a per-card subset from Google Fonts:
 * css2's `text=` param returns a font file containing only those glyphs.
 */
async function loadKoreanFont(text: string, weight: 400 | 700): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      )
    ).text();
    const url = css.match(/src:\s*url\((.+?)\)\s*format/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(Number(id));

  const tier = item?.tier ?? "참고";
  const color = TIER_COLOR[tier];
  const headline = item?.headlineKo ?? "실시간 AI 뉴스";
  const why = item?.whyKo ?? "";
  const source = item ? (SOURCE_NAMES[item.sourceId] ?? item.sourceId) : "";
  const dateKst = item
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(
        new Date(item.publishedAt)
      )
    : "";

  // "●" included explicitly — every glyph rendered must be in the subset.
  const cardText = `●promppy_실시간AI뉴스 .promppycom${tier}${headline}${why}${source}${dateKst}`;
  const [bold, regular] = await Promise.all([
    loadKoreanFont(cardText, 700),
    loadKoreanFont(cardText, 400),
  ]);
  const fonts = [
    ...(bold ? [{ name: "NotoKR", data: bold, style: "normal" as const, weight: 700 as const }] : []),
    ...(regular ? [{ name: "NotoKR", data: regular, style: "normal" as const, weight: 400 as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0e14",
          padding: "64px 72px",
          fontFamily: "NotoKR",
          borderLeft: `16px solid ${color}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#ffffff" }}>
            promppy<span style={{ color: "#ffb020" }}>_</span>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#8b949e" }}>실시간 AI 뉴스</div>
          <div
            style={{
              display: "flex",
              marginLeft: "auto",
              fontSize: 28,
              fontWeight: 700,
              color,
              border: `2px solid ${color}`,
              borderRadius: 8,
              padding: "6px 18px",
            }}
          >
            {tier}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontSize: 58,
              fontWeight: 700,
              color: "#e6edf3",
              lineHeight: 1.25,
            }}
          >
            {headline.length > 60 ? headline.slice(0, 60) + "…" : headline}
          </div>
          {why && (
            <div style={{ display: "flex", fontSize: 30, color: "#8b949e", lineHeight: 1.4 }}>
              {why}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 24,
            color: "#8b949e",
          }}
        >
          <div style={{ display: "flex" }}>{source && `${source} · ${dateKst}`}</div>
          <div style={{ display: "flex", color: "#3fb950" }}>● promppy.com</div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  );
}
