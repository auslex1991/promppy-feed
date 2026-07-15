// Verify the server-side push plumbing without a browser: VAPID config loads,
// DB subscription CRUD round-trips, and sendPushToAll no-ops cleanly with a
// bogus endpoint (which should be pruned, not throw).
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}
console.log("VAPID public key present:", Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY));
console.log("VAPID private key present:", Boolean(process.env.VAPID_PRIVATE_KEY));

const { addPushSubscription, getPushSubscriptions, deletePushSubscription } = await import("../src/lib/db");

const fake = {
  endpoint: "https://fcm.googleapis.com/fcm/send/__promppy_test__",
  p256dh: "BExampleKeyExampleKeyExampleKeyExampleKeyExampleKeyExampleKeyExampleKeyExampleKey00",
  auth: "ExampleAuthValue00",
};
await addPushSubscription(fake);
const after = await getPushSubscriptions();
console.log("subscription stored & retrieved:", after.some((s) => s.endpoint === fake.endpoint));

const { sendPushToAll, breakingPayload } = await import("../src/lib/push");
const payload = breakingPayload("테스트 속보: 이 문구는 실제 발송되지 않습니다", 99999);
console.log("payload:", JSON.stringify(payload));
const res = await sendPushToAll(payload);
console.log("sendPushToAll result:", JSON.stringify(res), "(bogus endpoint should be pruned)");

const remaining = await getPushSubscriptions();
console.log("test subscription cleaned up:", !remaining.some((s) => s.endpoint === fake.endpoint));
// Defensive: ensure removed even if not pruned
await deletePushSubscription(fake.endpoint);
process.exit(0);
