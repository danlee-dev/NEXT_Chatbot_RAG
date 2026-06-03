import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Pretendard는 globals.css 에서 CDN import. monospace 만 next/font 로.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stack Sage — AI 코딩 도구 메타 어드바이저",
  description:
    "Claude Code · Cursor · Codex CLI · Aider · Windsurf · Cline 등 AI 코딩 에이전트를 비교·추천하는 RAG 챗봇",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-theme="dark" className={`${jetbrains.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
