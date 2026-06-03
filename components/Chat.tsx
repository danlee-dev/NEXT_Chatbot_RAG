"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "framer-motion";

import { CharacterCard } from "@/components/CharacterCard";
import { MessageList } from "@/components/MessageList";
import { MessageInput } from "@/components/MessageInput";
import { IngestPanel } from "@/components/IngestPanel";
import { SourcePanel } from "@/components/SourcePanel";
import { characterConfig } from "@/lib/ai/prompts";

export type SessionSource = {
  url: string;
  title?: string;
  snippets: string[];
  chunkCount?: number;
};

export type SourceItem = {
  n: number;
  url: string | null;
  title: string | null;
  tag: string | null;
  type: string | null;
  content: string;
  score: number;
  kind: "rag" | "session";
};

const SUGGESTIONS = [
  "Cursor vs Claude Code, 큰 리팩터에 뭐가 나아?",
  "Aider 가 잘 어울리는 워크플로우는?",
  "Codex CLI 의 최근 changelog 요약해줘",
  "SWE-bench 1위 에이전트는 지금 어디?",
];

export function Chat() {
  const [sessionSources, setSessionSources] = useState<SessionSource[]>([]);
  const [highlightN, setHighlightN] = useState<number | null>(null);
  const [showInspector, setShowInspector] = useState(false);
  const [showNav, setShowNav] = useState(false);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, error, setMessages } = useChat({ transport });
  const isBusy = status === "submitted" || status === "streaming";

  const latestSources = useMemo<SourceItem[]>(() => {
    // 가장 최근 assistant 메시지에서 tool-rag_search / tool-fetch_url /
    // tool-compare_tools / tool-find_code_examples 결과들을 모두 수집해 카드로.
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const collected: SourceItem[] = [];
      let n = 1;
      type PartLite = {
        type: string;
        state?: string;
        output?: unknown;
      };
      const parts = (m.parts ?? []) as PartLite[];
      for (const part of parts) {
        if (part.state !== "output-available") continue;
        const out = part.output as Record<string, unknown> | undefined;
        if (!out) continue;
        const pushResults = (arr: unknown, kind: "rag" | "session") => {
          if (!Array.isArray(arr)) return;
          for (const r of arr as Array<Record<string, unknown>>) {
            collected.push({
              n: n++,
              url: (r.url as string | null) ?? null,
              title: (r.title as string | null) ?? null,
              tag: (r.tag as string | null) ?? null,
              type: (r.type as string | null) ?? null,
              content: (r.snippet as string | undefined) ?? "",
              score: typeof r.score === "number" ? r.score : 0,
              kind,
            });
          }
        };
        if (part.type === "tool-rag_search") pushResults(out.results, "rag");
        if (part.type === "tool-find_code_examples") pushResults(out.results, "rag");
        if (part.type === "tool-compare_tools") {
          pushResults(out.leftResults, "rag");
          pushResults(out.rightResults, "rag");
        }
        if (part.type === "tool-fetch_url") {
          const snippets = out.snippets as string[] | undefined;
          if (snippets?.length) {
            collected.push({
              n: n++,
              url: (out.url as string) ?? null,
              title: (out.title as string) ?? null,
              tag: "fetched",
              type: "fetched",
              content: snippets.join("\n\n"),
              score: 0,
              kind: "session",
            });
          }
        }
        if (part.type === "tool-web_search") pushResults(out.results, "rag");
      }
      if (collected.length > 0) return collected;
    }
    return [];
  }, [messages]);

  // 새 답변이 도착하면 inspector 자동 열기 (모바일에서는 사용자가 누르게 두는 게 덜 거슬림)
  const prevLen = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevLen.current && latestSources.length > 0) {
      setShowInspector(true);
    }
    prevLen.current = messages.length;
  }, [messages.length, latestSources.length]);

  function handleSend(text: string) {
    sendMessage({ text }, { body: { sessionSources } });
  }

  function handleCitationClick(n: number) {
    setShowInspector(true);
    setHighlightN(n);
    requestAnimationFrame(() => {
      const el = document.getElementById(`src-${n}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function handleAddSource(source: SessionSource) {
    setSessionSources((prev) => [...prev.filter((s) => s.url !== source.url), source]);
  }
  function handleRemoveSource(url: string) {
    setSessionSources((prev) => prev.filter((s) => s.url !== url));
  }

  function handleClear() {
    setMessages([]);
    setHighlightN(null);
  }

  return (
    <div className="flex h-full w-full" style={{ background: "var(--bg)" }}>
      {/* === Left nav === */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col gap-5 border-r px-4 py-5 lg:static lg:translate-x-0",
          showNav ? "translate-x-0" : "-translate-x-full",
          "transition-transform duration-200",
        ].join(" ")}
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
      >
        <CharacterCard character={characterConfig} />

        <div className="space-y-2">
          <SectionLabel>도구 카탈로그</SectionLabel>
          <CatalogList />
        </div>

        <div className="space-y-2">
          <SectionLabel>제안</SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => handleSend(s)}
                  className="block w-full rounded-[8px] px-2.5 py-2 text-left text-[12.5px] leading-snug transition"
                  style={{ color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-subtle)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
                  }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto space-y-2">
          <button
            type="button"
            onClick={handleClear}
            className="btn-ghost w-full"
            style={{ textAlign: "left" }}
          >
            대화 초기화
          </button>
        </div>
      </aside>

      {/* === Center main === */}
      <main className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenuToggle={() => setShowNav((v) => !v)}
          onInspectorToggle={() => setShowInspector((v) => !v)}
          sourceCount={latestSources.length}
        />

        <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-4 px-5 py-6 min-h-0">
          <div className="flex-1 overflow-y-auto pr-1">
            <MessageList
              messages={messages}
              isStreaming={status === "streaming"}
              onCitationClick={handleCitationClick}
              onSuggestionClick={handleSend}
            />
          </div>

          {error ? (
            <div
              className="rounded-[10px] px-3 py-2 text-[12.5px]"
              style={{
                background: "rgba(248, 113, 113, 0.08)",
                color: "var(--danger)",
                border: "1px solid rgba(248, 113, 113, 0.25)",
              }}
            >
              {error.message}
            </div>
          ) : null}

          <MessageInput onSend={handleSend} disabled={isBusy} />
        </div>
      </main>

      {/* === Right inspector === */}
      <aside
        className={[
          "fixed inset-y-0 right-0 z-30 flex w-[340px] flex-col gap-4 border-l px-4 py-5 lg:static lg:translate-x-0",
          showInspector ? "translate-x-0" : "translate-x-full",
          "transition-transform duration-200",
        ].join(" ")}
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
      >
        <IngestPanel
          sessionSources={sessionSources}
          onAdd={handleAddSource}
          onRemove={handleRemoveSource}
        />
        <SourcePanel sources={latestSources} highlightN={highlightN} />
      </aside>

      {/* mobile backdrop */}
      <AnimatePresence>
        {(showNav || showInspector) ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
            onClick={() => {
              setShowNav(false);
              setShowInspector(false);
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: "var(--fg-subtle)" }}
    >
      {children}
    </div>
  );
}

function CatalogList() {
  const tools: { name: string; meta: string }[] = [
    { name: "Claude Code", meta: "CLI · Anthropic" },
    { name: "Cursor", meta: "IDE fork" },
    { name: "Codex CLI", meta: "CLI · OpenAI" },
    { name: "Aider", meta: "CLI · OSS" },
    { name: "Windsurf", meta: "IDE · Codeium" },
    { name: "Cline", meta: "VSCode ext" },
    { name: "Zed AI", meta: "Editor native" },
    { name: "Continue", meta: "VSCode/JB ext" },
  ];
  return (
    <ul className="flex flex-col gap-[2px]">
      {tools.map((t) => (
        <li
          key={t.name}
          className="flex items-center justify-between rounded-[6px] px-2 py-1.5 text-[12.5px]"
          style={{ color: "var(--fg-muted)" }}
        >
          <span style={{ color: "var(--fg)" }}>{t.name}</span>
          <span className="font-mono text-[10.5px]" style={{ color: "var(--fg-subtle)" }}>
            {t.meta}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Topbar({
  onMenuToggle,
  onInspectorToggle,
  sourceCount,
}: {
  onMenuToggle: () => void;
  onInspectorToggle: () => void;
  sourceCount: number;
}) {
  return (
    <header
      className="flex h-[52px] items-center justify-between border-b px-4"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenuToggle}
          className="btn-ghost lg:hidden"
          aria-label="navigation 토글"
        >
          ☰
        </button>
        <div className="text-[12.5px] font-medium tracking-tight" style={{ color: "var(--fg-muted)" }}>
          Stack Sage
          <span className="opacity-50"> · </span>
          <span style={{ color: "var(--fg-subtle)" }}>AI coding agent advisor</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onInspectorToggle}
        className="btn-ghost flex items-center gap-2"
        aria-label="출처 패널 토글"
      >
        <span
          className="font-mono text-[11px]"
          style={{ color: sourceCount > 0 ? "var(--highlight)" : "var(--fg-subtle)" }}
        >
          {sourceCount}
        </span>
        <span>sources</span>
      </button>
    </header>
  );
}
