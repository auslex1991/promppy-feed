"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = "unsupported" | "idle" | "on" | "working";

/**
 * 속보 push opt-in. Anonymous: the browser's push subscription is the only
 * identity, stored server-side and fanned out when a 속보 item publishes.
 */
export default function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    // No VAPID key configured (e.g. keys not yet set in this environment) →
    // the feature can't work, so render nothing rather than a dead button.
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setState("unsupported");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "idle"))
      .catch(() => setState("idle"));
  }, []);

  async function enable() {
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("idle");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ) as BufferSource,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState("on");
    } catch {
      setState("idle");
    }
  }

  async function disable() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("idle");
    } catch {
      setState("on");
    }
  }

  if (state === "unsupported") return null;

  const on = state === "on";

  // Compact: an icon-only bell for the sticky header, where the full button is
  // too wide. This is the high-visibility placement — the footer button was
  // invisible to the ~85% who land on an item page and bounce.
  if (compact) {
    return (
      <button
        onClick={on ? disable : enable}
        disabled={state === "working"}
        aria-pressed={on}
        aria-label={on ? "속보 알림 켜짐" : "속보 알림 받기"}
        title={on ? "속보 알림 켜짐 (해제하려면 클릭)" : "속보가 뜨면 알림을 받아보세요"}
        className={`rounded-full border px-2 py-1 font-mono-ts text-xs transition-colors disabled:opacity-50 ${
          on
            ? "border-[#ff4d4f]/50 bg-[#ff4d4f]/10 text-[#ff4d4f]"
            : "border-[#30363d] text-[#8b949e] hover:border-[#8b949e] hover:text-[#c9d1d9]"
        }`}
      >
        {state === "working" ? "…" : on ? "🔔" : "🔕"}
      </button>
    );
  }

  return (
    <button
      onClick={on ? disable : enable}
      disabled={state === "working"}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1 font-mono-ts text-[11px] transition-colors disabled:opacity-50 ${
        on
          ? "border-[#ff4d4f]/50 bg-[#ff4d4f]/10 text-[#ff4d4f]"
          : "border-[#30363d] text-[#8b949e] hover:border-[#8b949e] hover:text-[#c9d1d9]"
      }`}
    >
      {state === "working" ? "…" : on ? "🔔 속보 알림 켜짐" : "🔔 속보 알림 받기"}
    </button>
  );
}
