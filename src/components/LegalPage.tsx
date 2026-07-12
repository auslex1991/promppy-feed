import Link from "next/link";

export default function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <Link href="/" className="font-mono-ts text-sm text-[#8b949e] hover:text-white">
        ← promppy<span className="text-[#ffb020]">_</span> 실시간 AI 뉴스
      </Link>

      <h1 className="mt-8 text-2xl font-bold text-[#e6edf3]">{title}</h1>
      <p className="mt-2 font-mono-ts text-xs text-[#8b949e]">시행일: {effectiveDate}</p>

      <div className="legal mt-8">{children}</div>

      <p className="mt-12">
        <Link href="/" className="font-mono-ts text-sm text-[#ffb020] hover:underline">
          더 많은 실시간 AI 뉴스 →
        </Link>
      </p>
    </main>
  );
}
