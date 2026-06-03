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
  "Gemini API function calling 어떻게 써?",
];

const NAV_W = 264;
const INSP_W = 340;
const SPRING = { type: "spring" as const, stiffness: 340, damping: 32, mass: 0.7 };

export function Chat() {
  const [sessionSources, setSessionSources] = useState<SessionSource[]>([]);
  const [highlightN, setHighlightN] = useState<number | null>(null);
  const [navOpen, setNavOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => {
      const m = window.matchMedia("(max-width: 1023px)").matches;
      setIsMobile(m);
      if (m) {
        setNavOpen(false);
        setInspectorOpen(false);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, error, setMessages } = useChat({ transport });
  const isBusy = status === "submitted" || status === "streaming";

  const latestSources = useMemo<SourceItem[]>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const collected: SourceItem[] = [];
      let n = 1;
      type PartLite = { type: string; state?: string; output?: unknown };
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

  // 새 답변이 도착하면 inspector 자동 열기 (모바일은 자동 X)
  const prevLen = useRef(messages.length);
  useEffect(() => {
    if (!isMobile && messages.length > prevLen.current && latestSources.length > 0) {
      setInspectorOpen(true);
    }
    prevLen.current = messages.length;
  }, [messages.length, latestSources.length, isMobile]);

  function handleSend(text: string) {
    sendMessage({ text }, { body: { sessionSources } });
  }

  function handleCitationClick(n: number) {
    setInspectorOpen(true);
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
    <div className="flex h-full w-full overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* ─── Left Nav ─── */}
      <AnimatePresence initial={false}>
        {navOpen ? (
          <motion.aside
            key="nav"
            initial={isMobile ? { x: -NAV_W } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: NAV_W, opacity: 1 }}
            exit={isMobile ? { x: -NAV_W } : { width: 0, opacity: 0 }}
            transition={SPRING}
            className={[
              "z-30 flex flex-col overflow-hidden",
              isMobile ? "fixed inset-y-0 left-0" : "relative",
            ].join(" ")}
            style={{
              background: "var(--surface-1)",
              boxShadow: isMobile ? "var(--elev-pop)" : "var(--elev-1)",
              width: isMobile ? NAV_W : undefined,
            }}
          >
            <div className="flex h-full w-[264px] flex-col gap-6 px-5 py-5 overflow-y-auto">
              <CharacterCard character={characterConfig} />
              <Section title="도구 카탈로그">
                <CatalogList />
              </Section>
              <Section title="제안">
                <ul className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <PressyButton
                        onClick={() => handleSend(s)}
                        className="block w-full text-left px-3 py-2.5 text-[12.5px] leading-snug"
                        style={{
                          color: "var(--fg-muted)",
                          background: "var(--surface-2)",
                          borderRadius: "var(--r-md)",
                        }}
                        hoverStyle={{ background: "var(--surface-3)", color: "var(--fg)" }}
                      >
                        {s}
                      </PressyButton>
                    </li>
                  ))}
                </ul>
              </Section>
              <div className="mt-auto">
                <PressyButton
                  onClick={handleClear}
                  className="w-full px-3 py-2 text-[12.5px] font-medium"
                  style={{
                    color: "var(--fg-muted)",
                    background: "var(--surface-2)",
                    borderRadius: "var(--r-pill)",
                  }}
                  hoverStyle={{ background: "var(--surface-3)", color: "var(--fg)" }}
                >
                  대화 초기화
                </PressyButton>
              </div>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {/* ─── Center Main ─── */}
      <motion.main
        layout
        transition={SPRING}
        className="flex min-w-0 flex-1 flex-col"
      >
        <Topbar
          navOpen={navOpen}
          inspectorOpen={inspectorOpen}
          onToggleNav={() => setNavOpen((v) => !v)}
          onToggleInspector={() => setInspectorOpen((v) => !v)}
          sourceCount={latestSources.length}
        />

        <div className="mx-auto flex w-full max-w-[780px] flex-1 flex-col gap-4 px-6 py-6 min-h-0">
          <div className="flex-1 overflow-y-auto pr-1">
            <MessageList
              messages={messages}
              isStreaming={status === "streaming"}
              isSubmitted={status === "submitted"}
              onCitationClick={handleCitationClick}
              onSuggestionClick={handleSend}
            />
          </div>

          {error ? (
            <div
              className="px-4 py-3 text-[12.5px]"
              style={{
                background: "rgba(248, 113, 113, 0.08)",
                color: "var(--danger)",
                borderRadius: "var(--r-md)",
              }}
            >
              {error.message}
            </div>
          ) : null}

          <MessageInput onSend={handleSend} disabled={isBusy} />
        </div>
      </motion.main>

      {/* ─── Right Inspector ─── */}
      <AnimatePresence initial={false}>
        {inspectorOpen ? (
          <motion.aside
            key="inspector"
            initial={isMobile ? { x: INSP_W } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: INSP_W, opacity: 1 }}
            exit={isMobile ? { x: INSP_W } : { width: 0, opacity: 0 }}
            transition={SPRING}
            className={[
              "z-30 flex flex-col overflow-hidden",
              isMobile ? "fixed inset-y-0 right-0" : "relative",
            ].join(" ")}
            style={{
              background: "var(--surface-1)",
              boxShadow: isMobile ? "var(--elev-pop)" : "var(--elev-1)",
              width: isMobile ? INSP_W : undefined,
            }}
          >
            <InspectorTabs
              sessionSources={sessionSources}
              onAdd={handleAddSource}
              onRemove={handleRemoveSource}
              sources={latestSources}
              highlightN={highlightN}
            />
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {/* mobile backdrop */}
      <AnimatePresence>
        {isMobile && (navOpen || inspectorOpen) ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-20"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => {
              setNavOpen(false);
              setInspectorOpen(false);
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type InspectorTab = "sources" | "session";

function InspectorTabs({
  sessionSources,
  onAdd,
  onRemove,
  sources,
  highlightN,
}: {
  sessionSources: SessionSource[];
  onAdd: (s: SessionSource) => void;
  onRemove: (url: string) => void;
  sources: SourceItem[];
  highlightN: number | null;
}) {
  const [tab, setTab] = useState<InspectorTab>("sources");
  const prevTab = useRef<InspectorTab>("sources");
  useEffect(() => {
    prevTab.current = tab;
  }, [tab]);

  const direction = tab === "sources" ? -1 : 1;

  return (
    <div className="flex h-full w-[340px] flex-col px-4 pt-4 pb-5 overflow-hidden">
      <TabBar
        tab={tab}
        setTab={setTab}
        sourceCount={sources.length}
        sessionCount={sessionSources.length}
      />

      <div className="relative mt-4 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={tab}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 24 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="absolute inset-0 overflow-y-auto pr-1"
          >
            {tab === "sources" ? (
              <SourcePanel sources={sources} highlightN={highlightN} />
            ) : (
              <IngestPanel
                sessionSources={sessionSources}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function TabBar({
  tab,
  setTab,
  sourceCount,
  sessionCount,
}: {
  tab: InspectorTab;
  setTab: (t: InspectorTab) => void;
  sourceCount: number;
  sessionCount: number;
}) {
  const tabs: { id: InspectorTab; label: string; count: number }[] = [
    { id: "sources", label: "출처", count: sourceCount },
    { id: "session", label: "세션", count: sessionCount },
  ];
  return (
    <div
      className="relative flex w-full items-center gap-1 p-1"
      style={{
        background: "var(--surface-2)",
        borderRadius: "var(--r-pill)",
      }}
    >
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="relative flex-1 px-3 py-1.5 text-[12.5px] font-semibold tracking-tight"
            style={{
              color: active ? "var(--fg)" : "var(--fg-subtle)",
              transition: "color 200ms",
              borderRadius: "var(--r-pill)",
            }}
          >
            {active ? (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0"
                style={{
                  background: "var(--surface-1)",
                  borderRadius: "var(--r-pill)",
                  boxShadow: "var(--elev-1)",
                }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-1.5">
              {t.label}
              {t.count > 0 ? (
                <span
                  className="font-mono text-[10px] tabular-nums"
                  style={{ color: active ? "var(--highlight)" : "var(--fg-subtle)" }}
                >
                  {t.count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--fg-subtle)" }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function CatalogList() {
  const tools: { name: string; meta: string }[] = [
    { name: "Claude Code", meta: "CLI" },
    { name: "Cursor", meta: "IDE" },
    { name: "Codex CLI", meta: "CLI" },
    { name: "Aider", meta: "CLI" },
    { name: "Windsurf", meta: "IDE" },
    { name: "Cline", meta: "VSCode" },
    { name: "Zed AI", meta: "Editor" },
    { name: "Continue", meta: "ext" },
  ];
  return (
    <ul className="flex flex-col gap-px">
      {tools.map((t) => (
        <li
          key={t.name}
          className="flex items-center justify-between rounded-[10px] px-3 py-2 text-[12.5px]"
          style={{ color: "var(--fg)" }}
        >
          <span>{t.name}</span>
          <span className="font-mono text-[10.5px]" style={{ color: "var(--fg-subtle)" }}>
            {t.meta}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Topbar({
  navOpen,
  inspectorOpen,
  onToggleNav,
  onToggleInspector,
  sourceCount,
}: {
  navOpen: boolean;
  inspectorOpen: boolean;
  onToggleNav: () => void;
  onToggleInspector: () => void;
  sourceCount: number;
}) {
  return (
    <header
      className="flex h-[56px] shrink-0 items-center justify-between px-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="flex items-center gap-1">
        <IconToggle
          active={navOpen}
          onClick={onToggleNav}
          label={navOpen ? "왼쪽 패널 닫기" : "왼쪽 패널 열기"}
          icon={<IconLeftPanel open={navOpen} />}
        />
        <div className="ml-2 text-[13px] font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
          Stack Sage
        </div>
        <span className="ml-2 text-[11.5px]" style={{ color: "var(--fg-subtle)" }}>
          AI coding agent advisor
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="font-mono text-[11px] tabular-nums px-2 py-1 rounded-[8px]"
          style={{ color: sourceCount > 0 ? "var(--highlight)" : "var(--fg-subtle)", background: sourceCount > 0 ? "var(--highlight-subtle)" : "transparent" }}
        >
          {sourceCount} sources
        </span>
        <IconToggle
          active={inspectorOpen}
          onClick={onToggleInspector}
          label={inspectorOpen ? "오른쪽 패널 닫기" : "오른쪽 패널 열기"}
          icon={<IconRightPanel open={inspectorOpen} />}
        />
      </div>
    </header>
  );
}

function IconToggle({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      transition={SPRING}
      className="grid h-9 w-9 place-items-center"
      style={{
        background: active ? "var(--surface-2)" : "transparent",
        color: active ? "var(--fg)" : "var(--fg-muted)",
        borderRadius: "var(--r-md)",
      }}
    >
      {icon}
    </motion.button>
  );
}

function IconLeftPanel({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="2.2" />
      <line x1="6" y1="3" x2="6" y2="13" />
      {open ? null : <line x1="9" y1="6" x2="11" y2="8" />}
      {open ? null : <line x1="11" y1="8" x2="9" y2="10" />}
    </svg>
  );
}

function IconRightPanel({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="2.2" />
      <line x1="10" y1="3" x2="10" y2="13" />
      {open ? null : <line x1="7" y1="6" x2="5" y2="8" />}
      {open ? null : <line x1="5" y1="8" x2="7" y2="10" />}
    </svg>
  );
}

/** 일반 버튼 + spring press/release. CSS hover 처리도 inline. */
function PressyButton({
  children,
  onClick,
  className,
  style,
  hoverStyle,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  hoverStyle?: React.CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={className}
      style={{ ...style, ...(hover && hoverStyle ? hoverStyle : null) }}
    >
      {children}
    </motion.button>
  );
}
