import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
});

const sansKr = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-sans-kr",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://promppy.com"),
  title: "promppy — 실시간 AI 뉴스",
  description:
    "AI 업계 소식을 실시간으로. 속보·중요·참고 자동 분류와 한 줄 시사점 — 한국 AI 실무자를 위한 뉴스 터미널.",
  openGraph: {
    title: "promppy — 실시간 AI 뉴스",
    description:
      "AI 업계 소식을 실시간으로. 속보·중요·참고 자동 분류와 한 줄 시사점 — 한국 AI 실무자를 위한 뉴스 터미널.",
    url: "/",
    siteName: "promppy",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "promppy — 실시간 AI 뉴스",
    description: "한국 AI 실무자를 위한 실시간 뉴스 터미널",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${mono.variable} ${sansKr.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#0a0e14] text-[#c9d1d9]">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
