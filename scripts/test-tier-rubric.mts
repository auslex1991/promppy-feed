// Re-classify real audited items against the sharpened rubric.
// Inflated cases (tips/comparisons/tool-shares) should now be 참고;
// genuinely forcing cases should stay 중요.
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}
const { classifyGeminiBatch } = await import("../src/lib/classify");

const now = new Date().toISOString();
type Case = { id: number; sourceId: string; title: string; excerpt: string; want: string };
const cases: Case[] = [
  { id: 1, sourceId: "reddit", want: "참고", // tip → 참고+팁
    title: "Building a repo-based context layer for ephemeral Claude Code environments",
    excerpt: "I kept re-explaining my architecture every cloud session, so I built a separate context monorepo with conventions and architecture docs that I link at session start. Standardizes agent dev environments." },
  { id: 2, sourceId: "reddit", want: "참고", // image-model comparison → 참고
    title: "Compared ZIT, Krea2T, Ideogram 4 against popular commercial models (real output images)",
    excerpt: "Side-by-side with original Unsplash sources. A practical reference when picking an image generation model." },
  { id: 3, sourceId: "x", want: "참고", // cost comparison writeup → 참고
    title: "Same-task experiment: Codex was 63% cheaper, but the developer chose Claude Code",
    excerpt: "Building the same dashboard cost $12 on Codex vs $33 on Claude Code. A cost-vs-autonomy tradeoff writeup." },
  { id: 4, sourceId: "hn", want: "참고", // niche research/model → 참고
    title: "Bonsai 27B: first 27B-class 1-bit LLM that runs on a phone",
    excerpt: "Qwen3.6 27B ternary-quantized from 18GB to run on-device. Interesting on-device agent research." },
  { id: 5, sourceId: "techcrunch", want: "중요", // Apple Siri AI — mainstream forcing
    title: "Apple unveils new AI Siri in iOS 27 public beta",
    excerpt: "Testing begins across 2.5 billion devices — the largest AI assistant rollout. On-device info access and app integration." },
  { id: 6, sourceId: "verge", want: "중요", // security exposure — forcing
    title: "SpaceXAI 'Grok Build' uploads entire user codebase to the cloud without consent",
    excerpt: "Transmits files you told it not to open, even deleted secrets. Serious data-exfiltration risk for anyone using AI coding CLIs." },
  { id: 7, sourceId: "zdnet-kr", want: "중요", // China model-access restriction — ops action
    title: "China weighs restricting access to foreign AI models; anthropomorphism rules take effect this week",
    excerpt: "Teams running DeepSeek, Qwen, GLM APIs must prepare for access restrictions and document migration costs." },
  { id: 8, sourceId: "reddit", want: "참고", // tool release / project share → 참고
    title: "Open-source 'uivet' for validating non-deterministic generative UI in CI",
    excerpt: "Samples N times and headless-renders to validate generative UI that differs each render. Complements pixel-diff and text eval." },
];

const map = await classifyGeminiBatch(
  cases.map((c) => ({ id: c.id, sourceId: c.sourceId, title: c.title, publishedAt: now, excerpt: c.excerpt })),
  []
);
let pass = 0;
for (const c of cases) {
  const r = map.get(c.id);
  const got = r?.action === "publish" ? r.tier : r?.action;
  const ok = got === c.want;
  if (ok) pass++;
  console.log(`${ok ? "PASS" : "FAIL"} want ${c.want} got ${got}${r?.is_tip ? " +팁" : ""} | ${c.title.slice(0, 55)}`);
}
console.log(`\n${pass}/${cases.length} passed`);
