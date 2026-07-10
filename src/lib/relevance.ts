/**
 * Cheap keyword/domain pre-filter for mixed-topic sources (HN, GeekNews, ZDNet
 * Korea). Dedicated AI sources bypass this; the LLM's `skip` action remains the
 * final relevance gate (SPEC.md §3).
 */
const AI_KEYWORDS = [
  "ai", "a.i.", "llm", "gpt", "claude", "gemini", "openai", "anthropic", "deepmind",
  "llama", "mistral", "grok", "xai", "copilot", "cursor", "hugging face", "huggingface",
  "transformer", "neural", "machine learning", "deep learning", "diffusion", "chatbot",
  "foundation model", "fine-tun", "rag", "agent", "inference", "model", "nvidia",
  // Korean
  "인공지능", "언어모델", "생성형", "챗봇", "딥러닝", "머신러닝", "에이전트", "반도체",
  "네이버 클로바", "하이퍼클로바", "카카오브레인", "엑사원",
];

const AI_DOMAINS = [
  "openai.com", "anthropic.com", "deepmind.google", "ai.meta.com", "mistral.ai",
  "x.ai", "huggingface.co", "arxiv.org", "cursor.com", "ollama.com", "together.ai",
  "groq.com", "cohere.com", "stability.ai",
];

export function isAiRelevant(title: string, url = ""): boolean {
  const t = ` ${title.toLowerCase()} `;
  if (AI_DOMAINS.some((d) => url.includes(d))) return true;
  return AI_KEYWORDS.some((k) =>
    k.length <= 3 ? t.includes(` ${k} `) || t.includes(` ${k}-`) : t.includes(k)
  );
}
