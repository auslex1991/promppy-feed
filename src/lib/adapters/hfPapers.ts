import type { RawItem } from "../types";

interface HfPaper {
  paper: { id: string; title: string; summary?: string; upvotes?: number };
  publishedAt?: string;
}

/** Hugging Face Daily Papers API — the arXiv traction gateway (SOURCES.md #13/#14). */
export async function fetchHfPapers(sourceId: string): Promise<RawItem[]> {
  const res = await fetch("https://huggingface.co/api/daily_papers?limit=30", {
    headers: { "User-Agent": "promppy-feed-bot/0.1" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HF papers HTTP ${res.status}`);
  const papers = (await res.json()) as HfPaper[];
  return papers
    .filter((p) => (p.paper.upvotes ?? 0) >= 20)
    .sort((a, b) => (b.paper.upvotes ?? 0) - (a.paper.upvotes ?? 0))
    .slice(0, 5)
    .map((p) => ({
      sourceId,
      url: `https://arxiv.org/abs/${p.paper.id}`,
      title: p.paper.title.trim(),
      publishedAt: p.publishedAt ?? null,
      excerpt: `${p.paper.upvotes} upvotes on HF Daily Papers. ${p.paper.summary ?? ""}`,
    }));
}
