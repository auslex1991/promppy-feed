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
};

export const TOPIC_SLUGS = new Set(Object.keys(TOPIC_LABELS));

export function topicLabel(slug: string): string {
  return TOPIC_LABELS[slug] ?? slug;
}
