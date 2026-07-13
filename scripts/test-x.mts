// One-off check of the expanded X adapter against the live API.
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}

const { fetchX } = await import("../src/lib/adapters/x");

const items = await fetchX("x");
console.log(`total items: ${items.length}\n`);
for (const i of items) {
  const likes = /좋아요 (\d+)/.exec(i.excerpt)?.[1] ?? "?";
  console.log(`♥${likes}  ${i.title.slice(0, 110)}`);
}
