import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <p className="font-mono-ts text-5xl font-bold text-[#30363d]">404</p>
      <h1 className="mt-4 text-lg font-semibold text-[#e6edf3]">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-[#8b949e]">
        주소가 잘못되었거나, 삭제된 항목일 수 있습니다.
      </p>
      <Link
        href="/"
        className="mt-8 rounded border border-[#30363d] px-5 py-2 font-mono-ts text-sm text-[#ffb020] transition-colors hover:border-[#ffb020]/50"
      >
        promppy<span className="text-[#ffb020]">_</span> 실시간 AI 뉴스로 →
      </Link>
    </main>
  );
}
