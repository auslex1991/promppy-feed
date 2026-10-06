/**
 * Korean names for AI brands and models, appended at render time:
 *   "Claude Opus 5 공개" → "Claude Opus 5(클로드 오푸스 5) 공개"
 *
 * Why render-time and not the classifier: Korean readers search both forms
 * (GSC: 키미 99 clicks, 코덱스 104, 제미나이 47, 오푸스 59), the classifier is
 * told to keep names in English, and 34k existing pages would otherwise never
 * get the Korean form. Applied once per name per page (title, h1, one-liner)
 * so the feed stays dense and pages don't read like a glossary.
 */

// Longest keys first so "Claude Code" wins over "Claude". A key may be
// followed by a version ("Opus 5", "Gemini 3.6", "GPT-5.6") which is carried
// into the Korean form: "Opus 5(오푸스 5)".
const NAMES: Array<[string, string]> = [
  ["Claude Code", "클로드 코드"],
  ["Claude Opus", "클로드 오푸스"],
  ["Claude Sonnet", "클로드 소넷"],
  ["Claude Haiku", "클로드 하이쿠"],
  ["Claude Fable", "클로드 페이블"],
  ["Hugging Face", "허깅페이스"],
  ["ChatGPT", "챗GPT"],
  ["OpenAI", "오픈AI"],
  ["Anthropic", "앤트로픽"],
  ["DeepSeek", "딥시크"],
  ["Perplexity", "퍼플렉시티"],
  ["Midjourney", "미드저니"],
  ["Microsoft", "마이크로소프트"],
  ["Copilot", "코파일럿"],
  ["MiniMax", "미니맥스"],
  ["Mistral", "미스트랄"],
  ["Windsurf", "윈드서프"],
  ["Upstage", "업스테이지"],
  ["NVIDIA", "엔비디아"],
  ["Nvidia", "엔비디아"],
  ["Gemini", "제미나이"],
  ["Claude", "클로드"],
  ["Sonnet", "소넷"],
  ["Cursor", "커서"],
  ["Ollama", "올라마"],
  ["Runway", "런웨이"],
  ["Google", "구글"],
  ["Fable", "페이블"],
  ["Haiku", "하이쿠"],
  ["Codex", "코덱스"],
  ["Llama", "라마"],
  ["Gemma", "젬마"],
  ["Opus", "오푸스"],
  ["Grok", "그록"],
  ["Kimi", "키미"],
  ["Qwen", "큐원"],
  ["Meta", "메타"],
  ["Apple", "애플"],
  ["Amazon", "아마존"],
  ["Tesla", "테슬라"],
  ["Sora", "소라"],
  ["Veo", "비오"],
  ["GPT", "GPT"], // placeholder: handled below as "GPT-5.6(지피티 5.6)"
];

const VERSION = String.raw`(?:[ -]?(?:v|[A-Z])?\d+(?:\.\d+)*[A-Za-z]?)?`;

const RULES = NAMES.map(([en, ko]) => ({
  en,
  ko,
  re: new RegExp(String.raw`(?<![A-Za-z])(${en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(${VERSION})(?![A-Za-z])`),
}));

/** Append the Korean name after the first mention of each brand/model. */
export function withKoreanNames(text: string): string {
  if (!text) return text;
  let out = text;
  for (const r of RULES) {
    if (r.en === "GPT") continue;
    // Already present in Korean (classifier wrote 앤트로픽 itself, or a longer
    // rule such as "Claude Code" has just added 클로드) → nothing to add.
    if (out.includes(r.ko)) continue;
    out = out.replace(r.re, (_m, name: string, ver: string) => {
      const v = ver ? ver.replace(/^[ -]?v?/, "") : "";
      return `${name}${ver}(${r.ko}${v ? " " + v : ""})`;
    });
  }
  // "GPT-5.6" / "GPT 5" / "GPT-6 Astra" → "GPT-5.6(지피티 5.6)". Bare "GPT" is
  // left alone; "지피티" alone is not a search term, and ChatGPT is covered.
  if (!out.includes("지피티")) {
    out = out.replace(/(?<![A-Za-z])(GPT)([ -]\d+(?:\.\d+)*[A-Za-z]?)(?![A-Za-z])/, (_m, g, v) => `${g}${v}(지피티 ${v.replace(/^[ -]/, "")})`);
  }
  return out;
}
