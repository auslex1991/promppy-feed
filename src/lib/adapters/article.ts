import * as cheerio from "cheerio";

/**
 * Best-effort article body extraction for sources whose feed carries no
 * excerpt (scraped official blogs, HF Blog). Returns up to ~1500 chars of the
 * main text, or "" on any failure — the classifier then falls back to
 * title-only, so this never blocks the pipeline.
 */
export async function fetchArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "promppy-feed-bot/0.1 (+https://promppy.com)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return "";
    const $ = cheerio.load(await res.text());
    $("script, style, nav, header, footer, aside, noscript").remove();

    // Prefer semantic containers; fall back to the whole body.
    const container = $("article").first().length
      ? $("article").first()
      : $("main").first().length
        ? $("main").first()
        : $("body");

    const text = container
      .find("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 40) // drop nav/caption fragments
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return text.slice(0, 1500);
  } catch {
    return "";
  }
}
