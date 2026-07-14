import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}
const { fetchX } = await import("../src/lib/adapters/x");

const items = await fetchX("x");
const lens = items.map((i) => i.excerpt.length);
console.log("total items:", items.length);
console.log(
  "excerpt length: max=" + Math.max(...lens),
  "min=" + Math.min(...lens),
  "avg=" + Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)
);
const over900 = items.filter((i) => i.excerpt.length > 900);
console.log("items >900 chars (were truncated before):", over900.length);
for (const i of over900.slice(0, 5)) {
  console.log("  " + i.excerpt.length + "ch | " + i.title.slice(0, 65));
}
