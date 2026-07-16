import type { FeedItem } from "./types";

// Relatedness by shared distinctive terms. No LLM call and no tags column, so
// it works retroactively on every already-published item. The joinable signal
// is mostly Latin: the rubric keeps product/company names in original form
// ("Claude", "GPT-5", "Siri", "Cursor"), so headlines about the same subject
// share those tokens across languages and sources.
const LATIN = /[a-zA-Z][a-zA-Z0-9]{2,}/g; // ≥3 chars — drops "ai", "of", "to"
const HANGUL = /[가-힣]{2,}/g;

// Weighted by inverse document frequency, so a rare shared term ("siri",
// "codex") dominates. IDF alone wasn't enough: generic Korean words that end
// most headlines ("등장", "공개", "출시") still scraped past the bar, so tokens
// appearing in more than DF_CAP of the pool are dropped outright as
// non-distinctive — including feed-wide words like "claude", which describe
// the whole feed rather than one topic.
const DF_CAP = 0.1;
// Deliberately high: this is a heuristic, and a wrong "related" link is worse
// than none, so only a genuinely distinctive shared term (a product or company
// name — "애플", "codex", "siri") clears the bar. Callers fall back to latest
// news when nothing does. Precision over recall.
const MIN_SCORE = 5.0;

// Korean news filler with no topical meaning. Kept SHORT on purpose: an
// earlier, broader list stripped words like "정책"/"사용량" that genuinely
// define a topic cluster (the rate-limit stories), which made results worse.
// IDF and DF_CAP handle merely-common words; this only removes ones that are
// pure connective tissue in every headline.
const STOP_KO = new Set([
  "공개", "출시", "발표", "등장", "이번", "위한", "통해", "대한",
  "최신", "무료", "가능", "제공", "추가", "시작", "예정", "지원",
]);

interface Doc {
  item: FeedItem;
  latin: Set<string>;
  text: string;
}

function rawText(i: { headlineKo: string; titleOrig: string }): string {
  return `${i.headlineKo} ${i.titleOrig}`.toLowerCase();
}

function latinTokens(text: string): Set<string> {
  return new Set(text.match(LATIN)?.map((t) => t.toLowerCase()) ?? []);
}

function hangulTokens(text: string): string[] {
  return [...new Set(text.match(HANGUL) ?? [])].filter((t) => !STOP_KO.has(t));
}

/**
 * Latin matches on whole tokens, Hangul on substrings. The asymmetry is
 * deliberate: "ios" must not match inside "studios" (that false hit put a
 * video-tool story on top of an Apple story), while Korean nouns carry
 * particles ("애플" inside "애플이"), so they need substring matching.
 */
function hits(doc: Doc, token: string, isLatin: boolean): boolean {
  return isLatin ? doc.latin.has(token) : doc.text.includes(token);
}

/** Items most topically related to `source`, best first. Empty when nothing clears the bar. */
export function pickRelated(source: FeedItem, candidates: FeedItem[], limit = 5): FeedItem[] {
  const n = candidates.length;
  if (n === 0) return [];
  const docs: Doc[] = candidates.map((item) => {
    const text = rawText(item);
    return { item, text, latin: latinTokens(text) };
  });

  const srcText = rawText(source);
  const terms: Array<{ token: string; isLatin: boolean; weight: number }> = [];
  const cap = Math.max(3, n * DF_CAP);
  for (const [tokens, isLatin] of [
    [[...latinTokens(srcText)], true],
    [hangulTokens(srcText), false],
  ] as Array<[string[], boolean]>) {
    for (const token of tokens) {
      const df = docs.reduce((acc, d) => acc + (hits(d, token, isLatin) ? 1 : 0), 0);
      if (df === 0 || df > cap) continue;
      terms.push({ token, isLatin, weight: Math.log(n / (1 + df)) });
    }
  }

  return docs
    .map((doc) => {
      let score = 0;
      for (const t of terms) if (hits(doc, t.token, t.isLatin)) score += t.weight;
      return { item: doc.item, score };
    })
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item);
}
