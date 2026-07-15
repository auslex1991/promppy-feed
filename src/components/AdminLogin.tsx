"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "로그인 실패");
    } catch {
      setErr("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-24">
      <h1 className="text-center font-mono-ts text-lg text-[#e6edf3]">
        promppy<span className="text-[#ffb020]">_</span> 관리자
      </h1>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="관리자 비밀번호"
          autoFocus
          className="rounded border border-[#30363d] bg-transparent px-3 py-2 font-mono-ts text-sm text-[#e6edf3] outline-none focus:border-[#8b949e]"
        />
        <button
          type="submit"
          disabled={busy || !pw}
          className="rounded bg-white/10 px-3 py-2 font-mono-ts text-sm text-white transition-colors hover:bg-white/15 disabled:opacity-50"
        >
          {busy ? "확인 중…" : "로그인"}
        </button>
        {err && <p className="text-center font-mono-ts text-xs text-[#ff4d4f]">{err}</p>}
      </form>
    </main>
  );
}
