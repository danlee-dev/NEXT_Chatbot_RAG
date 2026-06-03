import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stack Sage — AI 코딩 도구 메타 어드바이저",
  description:
    "Claude Code · Cursor · Codex CLI · Aider · Windsurf · Cline 등 AI 코딩 에이전트와 LLM/플랫폼 docs를 비교·추천하는 RAG 챗봇",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      data-theme="dark"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
