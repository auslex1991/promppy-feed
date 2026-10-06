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
  ["Stable Diffusion", "스테이블 디퓨전"],
  ["GitHub Copilot", "깃허브 코파일럿"],
  ["Nano Banana", "나노 바나나"],
  ["Google DeepMind", "구글 딥마인드"],
  ["LM Studio", "LM 스튜디오"],
  ["Scale AI", "스케일AI"],
  ["Stability AI", "스태빌리티AI"],
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
  ["GitHub", "깃허브"],
  ["Replit", "레플릿"],
  ["Lovable", "러버블"],
  ["Vercel", "버셀"],
  ["Cloudflare", "클라우드플레어"],
  ["Supabase", "수파베이스"],
  ["Firebase", "파이어베이스"],
  ["LangChain", "랭체인"],
  ["LangGraph", "랭그래프"],
  ["Notion", "노션"],
  ["Obsidian", "옵시디언"],
  ["Figma", "피그마"],
  ["Slack", "슬랙"],
  ["Discord", "디스코드"],
  ["Zapier", "재피어"],
  ["Stripe", "스트라이프"],
  ["Shopify", "쇼피파이"],
  ["Salesforce", "세일즈포스"],
  ["Samsung", "삼성"],
  ["Naver", "네이버"],
  ["Kakao", "카카오"],
  ["Hyundai", "현대"],
  ["Netflix", "넷플릭스"],
  ["YouTube", "유튜브"],
  ["Instagram", "인스타그램"],
  ["Threads", "스레드"],
  ["TikTok", "틱톡"],
  ["Twitter", "트위터"],
  ["Reddit", "레딧"],
  ["LinkedIn", "링크드인"],
  ["Spotify", "스포티파이"],
  ["Adobe", "어도비"],
  ["Photoshop", "포토샵"],
  ["Canva", "캔바"],
  ["Oracle", "오라클"],
  ["Intel", "인텔"],
  ["Qualcomm", "퀄컴"],
  ["Broadcom", "브로드컴"],
  ["ElevenLabs", "일레븐랩스"],
  ["Suno", "수노"],
  ["Kling", "클링"],
  ["Manus", "마누스"],
  ["Devin", "데빈"],
  ["Cognition", "코그니션"],
  ["Databricks", "데이터브릭스"],
  ["Snowflake", "스노우플레이크"],
  ["Palantir", "팔란티어"],
  ["SpaceX", "스페이스X"],
  ["DeepMind", "딥마인드"],
  ["Waymo", "웨이모"],
  ["Alibaba", "알리바바"],
  ["Tencent", "텐센트"],
  ["Baidu", "바이두"],
  ["ByteDance", "바이트댄스"],
  ["Huawei", "화웨이"],
  ["Xiaomi", "샤오미"],
  ["Moonshot", "문샷"],
  ["Groq", "그로크"],
  ["Cerebras", "세레브라스"],
  ["CoreWeave", "코어위브"],
  ["Azure", "애저"],
  ["Docker", "도커"],
  ["Kubernetes", "쿠버네티스"],
  ["Python", "파이썬"],
  ["JavaScript", "자바스크립트"],
  ["TypeScript", "타입스크립트"],
  ["React", "리액트"],
  ["JetBrains", "젯브레인즈"],
  ["iPhone", "아이폰"],
  ["Android", "안드로이드"],
  ["Chrome", "크롬"],
  ["Linux", "리눅스"],
  ["ComfyUI", "콤피UI"],
  ["Imagen", "이매진"],
  ["Pika", "피카"],
  ["Luma", "루마"],
  ["Zoom", "줌"],
  ["Uber", "우버"],
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
