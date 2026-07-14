// Regression test for the X-substance loosening, using real posts from
// today's skip list: scoops/commentary should now publish; jokes/banter and
// off-topic bait must still skip.
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}

const { classifyGeminiBatch } = await import("../src/lib/classify");

const now = new Date().toISOString();
const items = [
  {
    id: 1, // scoop roundup → publish now
    sourceId: "x",
    title: "@maria_rcks: 🚨 SCOOP(s) - Anthropic is reportedly training a new model - OpenAI works on the ChatGP",
    publishedAt: now,
    excerpt:
      "Post by @maria_rcks on X (좋아요 412). 🚨 SCOOP(s) - Anthropic is reportedly training a new model expected next month - OpenAI works on the ChatGPT redesign with a unified sidebar - Google preparing Gemini integration for Workspace admin consoles. Sources familiar with the matter.",
  },
  {
    id: 2, // one-line joke → still skip
    sourceId: "x",
    title: "@tenobrus: google is sort of like anthropic if every anthropic release was sonnet 5",
    publishedAt: now,
    excerpt:
      "Post by @tenobrus on X (좋아요 231). google is sort of like anthropic if every anthropic release was sonnet 5",
  },
  {
    id: 3, // usage-data reporting → publish now
    sourceId: "x",
    title: "@edzitron: Adweek - Emarketer's data finds that chatbots like ChatGPT, Microsoft Copilot app, Googl",
    publishedAt: now,
    excerpt:
      "Post by @edzitron on X (좋아요 187). Adweek - Emarketer's data finds that chatbots like ChatGPT, Microsoft Copilot app, Google Gemini saw US usage growth slow to 6.1% this year from 34% last year, suggesting the consumer chatbot market is maturing faster than expected.",
  },
  {
    id: 4, // burger-shop shitpost mentioning nothing AI-substantive → still skip
    sourceId: "x",
    title: "@kunley_drukpa: >open new smash burger place with my cousins mohammed and big mo >wallahi we",
    publishedAt: now,
    excerpt:
      "Post by @kunley_drukpa on X (좋아요 998). >open new smash burger place with my cousins mohammed and big mo >wallahi we use claude to write the menu >the AI said add more onions >best burger in bradford",
  },
];

const map = await classifyGeminiBatch(items, []);
const expect: Record<number, string> = { 1: "publish", 2: "skip", 3: "publish", 4: "skip" };
let pass = 0;
for (const it of items) {
  const r = map.get(it.id);
  const ok = r?.action === expect[it.id];
  if (ok) pass++;
  console.log(`${ok ? "PASS" : "FAIL"} id=${it.id} want ${expect[it.id]} got ${r?.action} [${r?.tier ?? "-"}] ${r?.headline_ko ?? ""}`);
}
console.log(`\n${pass}/${items.length} passed`);
