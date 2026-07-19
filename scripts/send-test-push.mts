// Fire a test 속보 push to all current subscribers (ops verification).
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}
const { getPushSubscriptions } = await import("../src/lib/db");
const { sendPushToAll } = await import("../src/lib/push");
const subs = await getPushSubscriptions();
console.log("current subscriptions:", subs.length);
if (subs.length === 0) {
  console.log("→ nobody subscribed yet. Subscribe on the site first, then re-run.");
  process.exit(0);
}
const res = await sendPushToAll({
  title: "🔴 promppy 알림 테스트",
  body: "속보 알림이 정상 작동합니다. 실제 속보가 뜨면 이렇게 도착합니다.",
  url: "https://www.promppy.com",
  tag: "promppy-test",
});
console.log("sent:", res.sent, "| pruned(dead):", res.pruned);
process.exit(0);
