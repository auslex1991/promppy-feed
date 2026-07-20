import Link from "next/link";
import type { Sponsor } from "@/lib/types";

/**
 * The single paid placement. Two deliberate choices:
 *  - It is labelled AD unambiguously. A news feed's value is trust; disguising
 *    the ad would earn a few more clicks and cost the thing being sold.
 *  - When unsold it advertises the slot itself, so inventory is never wasted
 *    and prospects can see exactly what they'd be buying.
 */
export default function SponsorSlot({ sponsor }: { sponsor?: Sponsor | null }) {
  if (!sponsor) {
    return (
      <Link
        href="/advertise"
        className="group my-1 block border-b border-l-2 border-[#161b22] border-l-[#30363d] px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="rounded border border-[#30363d] px-1.5 py-px font-mono-ts text-[11px] text-[#8b949e]/70">
            AD
          </span>
          <span className="min-w-0 flex-1 basis-full text-[15px] font-medium leading-snug text-[#8b949e] group-hover:text-[#c9d1d9] sm:basis-auto">
            이 자리에서 한국 AI 실무자에게 도달하세요
          </span>
          <span className="ml-auto shrink-0 font-mono-ts text-[11px] text-[#8b949e]/60">광고 문의 →</span>
        </div>
        <p className="mt-1 pl-0 text-[13px] leading-relaxed text-[#8b949e]/70 sm:pl-[76px]">
          promppy는 매일 AI 뉴스를 찾아보는 개발자·실무자가 읽는 실시간 피드입니다.
        </p>
      </Link>
    );
  }

  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener sponsored"
      className="group my-1 block border-b border-l-2 border-[#161b22] border-l-[#ffb020]/40 bg-[#ffb020]/[0.03] px-3 py-2.5 transition-colors hover:bg-[#ffb020]/[0.06]"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded border border-[#ffb020]/40 bg-[#ffb020]/10 px-1.5 py-px font-mono-ts text-[11px] font-medium text-[#ffb020]">
          AD
        </span>
        <span className="min-w-0 flex-1 basis-full text-[15px] font-medium leading-snug text-[#e6edf3] group-hover:underline sm:basis-auto">
          {sponsor.title}
        </span>
        <span className="ml-auto min-w-0 shrink truncate font-mono-ts text-[11px] text-[#8b949e]/70">
          {sponsor.brand} ↗
        </span>
      </div>
      {sponsor.body && (
        <p className="mt-1 pl-0 text-[13px] leading-relaxed text-[#8b949e] sm:pl-[76px]">{sponsor.body}</p>
      )}
    </a>
  );
}
