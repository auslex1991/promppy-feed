"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";

/**
 * Internal link that reports a custom event before navigating. Lets us see
 * WHICH conversion lever works (feed CTA vs 다음 뉴스 card vs 관련 vs 최신)
 * instead of only watching the aggregate bounce rate move.
 */
export default function TrackedLink({
  event,
  href,
  className,
  children,
}: {
  event: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => track(event)}>
      {children}
    </Link>
  );
}
