"use client";

import { useState } from "react";
import type { Sponsor } from "@/lib/types";

/** Set or clear the single paid feed placement. Empty slot = self-promo card. */
export default function AdminSponsor({ initial }: { initial: Sponsor | null }) {
  const [sponsor, setSponsorState] = useState<Sponsor | null>(initial);
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, title, body, url }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; sponsor?: Sponsor };
      if (!res.ok) setMsg(data.error ?? "저장 실패");
      else {
        setSponsorState(data.sponsor ?? null);
        setMsg("저장됨 — 피드에 노출됩니다");
      }
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setMsg(null);
    try {
      await fetch("/api/admin/sponsor", { method: "DELETE" });
      setSponsorState(null);
      setBrand("");
      setTitle("");
      setBody("");
      setUrl("");
      setMsg("삭제됨 — '광고 문의' 카드가 표시됩니다");
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded border border-[#30363d] bg-transparent px-3 py-1.5 font-mono-ts text-sm text-[#e6edf3] outline-none focus:border-[#8b949e]";

  return (
    <section className="mt-10 border-t border-[#161b22] pt-8">
      <h2 className="font-mono-ts text-sm font-semibold text-[#e6edf3]">
        스폰서 슬롯{" "}
        <span className={sponsor ? "text-[#ffb020]" : "text-[#8b949e]"}>
          ({sponsor ? "판매됨" : "비어 있음"})
        </span>
      </h2>
      <p className="mt-1 font-mono-ts text-[11px] text-[#8b949e]">
        피드 6번째 위치 · 비워두면 &quot;광고 문의&quot; 카드가 자동 노출됩니다. 최대 60초 후 반영.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="브랜드명 (예: Acme AI)" className={input} />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목 한 줄" className={input} />
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="설명 한 줄 (선택)" className={input} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className={input} />
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy || !brand.trim() || !title.trim() || !url.trim()}
            className="rounded bg-[#ffb020] px-4 py-1.5 font-mono-ts text-sm font-medium text-[#0a0e14] transition-colors hover:bg-[#ffc247] disabled:opacity-50"
          >
            저장
          </button>
          {sponsor && (
            <button
              onClick={clear}
              disabled={busy}
              className="rounded border border-[#30363d] px-4 py-1.5 font-mono-ts text-sm text-[#8b949e] transition-colors hover:border-[#ff4d4f]/50 hover:text-[#ff4d4f] disabled:opacity-50"
            >
              삭제
            </button>
          )}
          {msg && <span className="font-mono-ts text-[11px] text-[#8b949e]">{msg}</span>}
        </div>
      </div>
    </section>
  );
}
