// Gate check: the open viral search's junk must be dropped, real items kept.
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}

const { gateItem } = await import("../src/lib/classify");

const cases: Array<{ want: boolean; title: string; excerpt: string }> = [
  {
    want: false,
    title: "@RightWingCope: Sneako accidentally forgot to remove his ChatGPT prompt while posting one of his cringe Islam posts",
    excerpt: "Post by @RightWingCope on X (좋아요 5509). Sneako accidentally forgot to remove his ChatGPT prompt while posting one of his cringe Islam posts. Absolute clown behavior.",
  },
  {
    want: false,
    title: "@roboticjoey: Anyone that likes this post will receive their share! Reply with your Zodiac Sign",
    excerpt: "Post by @roboticjoey on X (좋아요 520). Anyone that likes this post will receive their share! Reply with your Zodiac Sign: Aries: $3,000 ... powered by our AI agent.",
  },
  {
    want: false,
    title: "@ShieldsClips: An executive at OpenAI blocked me when I quote tweeted him praising how the Talmud is instrumental",
    excerpt: "Post by @ShieldsClips on X (좋아요 562). An executive at OpenAI blocked me when I quote tweeted him praising how the Talmud is instrumental to his thinking.",
  },
  {
    want: true,
    title: "@AnthropicAI: In previous research, we found that Claude expresses over 3,000 values, like honesty and warmth.",
    excerpt: "Post by @AnthropicAI on X (좋아요 1833). In previous research, we found that Claude expresses over 3,000 values, like honesty and warmth. Today we publish a follow-up on how those values shift under pressure.",
  },
  {
    want: true,
    title: "@OfficialLoganK: The Agentic Coding Environment (ACE) is the natural successor to the IDE",
    excerpt: "Post by @OfficialLoganK on X (좋아요 634). The Agentic Coding Environment (ACE) is the natural successor to the IDE (Integrated Development Environment). Here is what changes for developers.",
  },
];

let pass = 0;
for (const c of cases) {
  const keep = await gateItem({ sourceId: "x", title: c.title, excerpt: c.excerpt });
  const ok = keep === c.want;
  if (ok) pass++;
  console.log(`${ok ? "PASS" : "FAIL"}  want keep=${c.want} got=${keep}  ${c.title.slice(0, 70)}`);
}
console.log(`\n${pass}/${cases.length} passed`);
