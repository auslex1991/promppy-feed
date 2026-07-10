import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
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
  title: "promppy — 실시간 AI 뉴스",
  description: "AI 업계 소식을 15분 단위로. 한국 AI 실무자를 위한 실시간 뉴스 터미널.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${mono.variable} ${sansKr.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#0a0e14] text-[#c9d1d9]">{children}</body>
    </html>
  );
}
