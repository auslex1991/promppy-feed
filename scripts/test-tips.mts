// Live check of the tips rubric: X tips publish at low like counts with
// is_tip=true; chatter still skips; product news is not tagged as a tip.
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}

const { classifyGeminiBatch } = await import("../src/lib/classify");

const items = [
  {
    id: 1, // low-like X tip → publish, is_tip
    sourceId: "x",
    title: "@swyx: The single biggest Claude Code productivity unlock: put a PLANS.md at repo root",
    publishedAt: new Date().toISOString(),
    excerpt:
      "Post by @swyx on X (좋아요 41). The single biggest Claude Code productivity unlock: put a PLANS.md at repo root and tell the agent to update it after every task. Context survives compaction, new sessions resume instantly, and you can diff what it thinks it did vs what it did. Works in Cursor too via .cursorrules.",
  },
  {
    id: 2, // low-like X chatter → skip
    sourceId: "x",
    title: "@levelsio: honestly AI coding is just more fun than regular coding",
    publishedAt: new Date().toISOString(),
    excerpt:
      "Post by @levelsio on X (좋아요 88). honestly AI coding is just more fun than regular coding, I look forward to work now lol",
  },
  {
    id: 3, // real product news → publish, NOT a tip
    sourceId: "x",
    title: "@MistralAI: Announcing Mistral Large 3.2 — 40% cheaper inference, new 256k context window",
    publishedAt: new Date().toISOString(),
    excerpt:
      "Post by @MistralAI on X (좋아요 2100). Announcing Mistral Large 3.2 — 40% cheaper inference, new 256k context window, available today on La Plateforme and AWS Bedrock.",
  },
];

const map = await classifyGeminiBatch(items, []);
const expect: Record<number, { action: string; tip: boolean }> = {
  1: { action: "publish", tip: true },
  2: { action: "skip", tip: false },
  3: { action: "publish", tip: false },
};
let pass = 0;
for (const it of items) {
  const r = map.get(it.id);
  const e = expect[it.id];
  const ok = r?.action === e.action && Boolean(r?.is_tip) === e.tip;
  if (ok) pass++;
  console.log(
    `${ok ? "PASS" : "FAIL"} id=${it.id} want ${e.action}/tip=${e.tip} got ${r?.action}/tip=${Boolean(r?.is_tip)} [${r?.tier ?? "-"}] ${r?.headline_ko ?? ""}`
  );
}
console.log(`\n${pass}/${items.length} passed`);
