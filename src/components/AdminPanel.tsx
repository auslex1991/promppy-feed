"use client";

import { useState } from "react";

type Kind = "org" | "people";

function Section({
  title,
  hint,
  kind,
  accounts,
  onAdd,
  onRemove,
}: {
  title: string;
  hint: string;
  kind: Kind;
  accounts: string[];
  onAdd: (kind: Kind, handle: string) => Promise<string | null>;
  onRemove: (kind: Kind, handle: string) => void;
}) {
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!input.trim()) return;
    setBusy(true);
    setErr(null);
    const error = await onAdd(kind, input.trim());
    if (error) setErr(error);
    else setInput("");
    setBusy(false);
  }

  return (
    <section className="mt-8">
      <h2 className="font-mono-ts text-sm font-semibold text-[#e6edf3]">
        {title} <span className="text-[#8b949e]">({accounts.length})</span>
      </h2>
      <p className="mt-1 font-mono-ts text-[11px] text-[#8b949e]">{hint}</p>
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="@handle 또는 x.com/handle"
          className="min-w-0 flex-1 rounded border border-[#30363d] bg-transparent px-3 py-1.5 font-mono-ts text-sm text-[#e6edf3] outline-none focus:border-[#8b949e]"
        />
        <button
          onClick={add}
          disabled={busy || !input.trim()}
          className="rounded bg-white/10 px-4 py-1.5 font-mono-ts text-sm text-white transition-colors hover:bg-white/15 disabled:opacity-50"
        >
          추가
        </button>
      </div>
      {err && <p className="mt-1.5 font-mono-ts text-[11px] text-[#ff4d4f]">{err}</p>}
      <ul className="mt-3 flex flex-wrap gap-2">
        {accounts.map((h) => (
          <li
            key={h}
            className="flex items-center gap-1.5 rounded-full border border-[#30363d] py-0.5 pl-3 pr-1.5 font-mono-ts text-[12px] text-[#c9d1d9]"
          >
            @{h}
            <button
              onClick={() => onRemove(kind, h)}
              aria-label={`${h} 삭제`}
              className="flex h-4 w-4 items-center justify-center rounded-full text-[#8b949e] transition-colors hover:bg-[#ff4d4f]/20 hover:text-[#ff4d4f]"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminPanel({
  initialOrg,
  initialPeople,
}: {
  initialOrg: string[];
  initialPeople: string[];
}) {
  const [org, setOrg] = useState(initialOrg);
  const [people, setPeople] = useState(initialPeople);

  async function onAdd(kind: Kind, raw: string): Promise<string | null> {
    const res = await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: raw, kind }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; handle?: string };
    if (!res.ok || !data.handle) return data.error ?? "추가 실패";
    const setter = kind === "org" ? setOrg : setPeople;
    setter((prev) => (prev.includes(data.handle!) ? prev : [...prev, data.handle!].sort()));
    return null;
  }

  async function onRemove(kind: Kind, handle: string) {
    const setter = kind === "org" ? setOrg : setPeople;
    setter((prev) => prev.filter((h) => h !== handle)); // optimistic
    await fetch("/api/admin/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    }).catch(() => {});
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" }).catch(() => {});
    window.location.reload();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-mono-ts text-lg text-[#e6edf3]">
          promppy<span className="text-[#ffb020]">_</span> X 계정 관리
        </h1>
        <button onClick={logout} className="font-mono-ts text-xs text-[#8b949e] hover:text-white">
          로그아웃
        </button>
      </div>
      <p className="mt-2 font-mono-ts text-[11px] text-[#8b949e]">
        변경사항은 즉시 저장되며 다음 크롤링(15분마다)부터 반영됩니다.
      </p>

      <Section
        title="기관 계정 (ORG)"
        hint="발표·공지 위주 — 좋아요 수 제한 없이 게이트로 직행. 2시간 윈도우."
        kind="org"
        accounts={org}
        onAdd={onAdd}
        onRemove={onRemove}
      />
      <Section
        title="인물 계정 (PEOPLE)"
        hint="좋아요 5개 이상 + LLM 게이트 통과 시 수집. 12시간 윈도우."
        kind="people"
        accounts={people}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    </main>
  );
}
