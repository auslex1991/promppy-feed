// Controlled topic vocabulary. Slugs are URLs (/topic/<slug>) — keep them
// stable. The classifier (classify.ts) validates its output against this set,
// and topic pages 404 on anything outside it.
export const TOPIC_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  meta: "Meta",
  xai: "xAI",
  mistral: "Mistral",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  nvidia: "NVIDIA",
  microsoft: "Microsoft",
  apple: "Apple",
  perplexity: "Perplexity",
  "korea-ai": "한국 AI",
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  grok: "Grok",
  llama: "Llama",
  gpt: "GPT",
  codex: "Codex",
  cursor: "Cursor",
  copilot: "Copilot",
  "claude-code": "Claude Code",
  huggingface: "Hugging Face",
  agent: "AI 에이전트",
  rag: "RAG",
  "fine-tuning": "파인튜닝",
  "open-source": "오픈소스",
  benchmark: "벤치마크",
  funding: "투자·펀딩",
  regulation: "규제·정책",
  security: "보안",
  hardware: "하드웨어",
  pricing: "가격·요금",
  prompt: "프롬프트",
  mcp: "MCP",
  research: "연구",
  multimodal: "멀티모달",
  "image-gen": "이미지 생성",
  "video-gen": "비디오 생성",
  robotics: "로보틱스",
  career: "커리어",
  // Emergent model slugs — added as GSC shows real search demand for a newly
  // launched model. These lean on TOPIC_KEYWORDS below so the hub page fills
  // from existing coverage the moment the slug is added, without waiting for
  // the classifier to re-tag anything.
  "kimi-k3": "Kimi K3",
  "opus-5": "Claude Opus 5",
  "bonsai-27b": "Bonsai 27B",
  // Practitioner long-tail hub. Analytics (2026-09) showed 4 of the 6 most
  // visited item pages were local-model / hardware how-tos ("128GB Mac vs
  // DGX", Qwen local-run reports) — 참고-tier content that outranks big
  // outlets on niche queries. ~355 matching items/30d existed with no page.
  "local-llm": "로컬 LLM",
  // From the 2026-09-04 GSC export: 499 queries / 4,888 clicks had no hub.
  // Each slug below had 49–500 published items already, so the page fills
  // on day one. Thin candidates (eli5: 5 items, neurips: 10) were skipped —
  // an empty hub reads as thin content to Google and is worse than none.
  minimax: "MiniMax",
  "fable-5": "Claude Fable 5",
  "gpt-5-6": "GPT-5.6",
  "glm-5": "GLM 5",
  muse: "Muse",
  "ox-alpha": "OX Alpha",
  comfyui: "ComfyUI",
};

// Korean names searchers actually type (GSC: 키미 99 clicks, 코덱스 104,
// 제미나이 47, 오푸스 59). Rendered in the hub title/h1 so the page contains
// the query string — the English-only title never matched these.
export const TOPIC_ALIASES: Record<string, string> = {
  "kimi-k3": "키미 K3",
  gemini: "제미나이",
  codex: "코덱스",
  "opus-5": "오푸스 5",
  claude: "클로드",
  grok: "그록",
  minimax: "미니맥스",
  "fable-5": "페이블 5",
  "local-llm": "로컬 LLM 구동",
};

// Optional headline keywords per slug. When present, a topic page matches items
// whose HEADLINE contains any keyword, in addition to the classifier tag — so
// a model that didn't exist when the tag vocabulary was written still gets a
// fully-populated page. Established topics have no keywords (pure tag match).
// Keep keywords specific enough to avoid false positives; matching is
// case-insensitive substring against headline_ko + title_orig.
export const TOPIC_KEYWORDS: Record<string, string[]> = {
  "kimi-k3": ["kimi k3", "kimi-k3", "kimik3", "kimi3", "kimi 3", "키미 k3", "키미3", "키미 3"],
  "opus-5": ["opus 5", "opus-5", "opus5", "opus 5.1", "오푸스 5", "오푸스5"],
  "bonsai-27b": ["bonsai 27b", "bonsai-27b", "bonsai27b"],
  "local-llm": [
    "로컬", "local llm", "ollama", "llama.cpp", "lm studio", "온디바이스",
    "on-device", "gguf", "양자화", "quantiz", "vllm", "exo ",
  ],
  minimax: ["minimax", "미니맥스"],
  "fable-5": ["fable 5", "fable-5", "fable5", "claude fable", "페이블 5"],
  "gpt-5-6": ["gpt 5.6", "gpt-5.6", "gpt5.6", "luna max", "sol medium", "5.6 luna", "5.6 sol"],
  "glm-5": ["glm 5", "glm-5", "glm5"],
  muse: ["muse code", "muse spark", "muse glimmer"],
  "ox-alpha": ["ox 알파", "ox alpha", "ox-alpha"],
  comfyui: ["comfyui"],
};

export const TOPIC_SLUGS = new Set(Object.keys(TOPIC_LABELS));

export function topicLabel(slug: string): string {
  return TOPIC_LABELS[slug] ?? slug;
}

export function topicKeywords(slug: string): string[] {
  return TOPIC_KEYWORDS[slug] ?? [];
}

/** "Gemini (제미나이)" when an alias exists, else the label. For titles/h1. */
export function topicTitle(slug: string): string {
  const alias = TOPIC_ALIASES[slug];
  return alias ? `${topicLabel(slug)} (${alias})` : topicLabel(slug);
}
