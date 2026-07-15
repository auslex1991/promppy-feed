import webpush from "web-push";
import { getPushSubscriptions, deletePushSubscription } from "./db";
import { SITE_URL } from "./site";

let configured = false;

function ensureConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails("mailto:admin@promppy.com", pub, priv);
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/**
 * Fan a notification out to every stored subscription. Dead endpoints
 * (404/410) are pruned. Never throws — a push failure must not break the
 * crawl that triggered it.
 */
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  if (!ensureConfigured()) return { sent: 0, pruned: 0 };
  const subs = await getPushSubscriptions();
  const body = JSON.stringify(payload);
  let sent = 0;
  let pruned = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        sent++;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await deletePushSubscription(s.endpoint);
          pruned++;
        }
      }
    })
  );
  return { sent, pruned };
}

export function breakingPayload(headlineKo: string, itemId: number): PushPayload {
  return {
    title: "🔴 속보 · promppy",
    body: headlineKo,
    url: `${SITE_URL}/item/${itemId}`,
    tag: `promppy-item-${itemId}`,
  };
}
