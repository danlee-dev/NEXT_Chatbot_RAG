"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ToolPart = {
  type: string;
  toolCallId?: string;
  state?: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

const TOOL_META: Record<string, { label: string; emoji: string; verb: string }> = {
  "tool-rag_search":         { label: "rag_search",          emoji: "▸", verb: "내부 RAG 검색" },
  "tool-fetch_url":          { label: "fetch_url",           emoji: "↗", verb: "URL 본문 가져오기" },
  "tool-web_search":         { label: "web_search",          emoji: "✱", verb: "외부 웹 검색" },
  "tool-list_recent_releases": { label: "list_recent_releases", emoji: "◷", verb: "최근 changelog" },
  "tool-compare_tools":      { label: "compare_tools",       emoji: "⇄", verb: "도구 비교" },
  "tool-find_code_examples": { label: "find_code_examples",  emoji: "</>", verb: "코드 예제 검색" },
  "tool-freshness_check":    { label: "freshness_check",     emoji: "◐", verb: "신선도 점검" },
  "tool-list_tags":          { label: "list_tags",           emoji: "≡", verb: "인덱스 catalog" },
};

export function ToolCard({ part }: { part: ToolPart }) {
  const meta = TOOL_META[part.type] ?? { label: part.type, emoji: "•", verb: "도구 호출" };
  const [open, setOpen] = useState(false);

  const state = part.state ?? "input-streaming";
  const isStreaming = state === "input-streaming";
  const isInputReady = state === "input-available";
  const isDone = state === "output-available";
  const isError = state === "output-error";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.6 }}
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-card)",
        padding: "10px 12px 10px 14px",
      }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-2.5">
        <StatusDot state={state} />
        <span
          className="font-mono text-[10px] font-semibold opacity-90"
          style={{ color: "var(--fg-subtle)", letterSpacing: "0.04em" }}
        >
          {meta.emoji}
        </span>
        <span className="text-[12.5px] font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
          {meta.verb}
        </span>
        <span className="font-mono text-[10.5px]" style={{ color: "var(--fg-subtle)" }}>
          {meta.label}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ResultSummary part={part} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="font-mono text-[11px] tabular-nums"
            style={{ color: "var(--fg-subtle)" }}
            aria-label={open ? "접기" : "펼치기"}
          >
            {open ? "▾" : "▸"}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mt-2 space-y-2"
          >
            <PayloadBlock label="input" value={part.input} streaming={isStreaming} />
            {(isDone || isError) ? (
              <PayloadBlock label="output" value={isError ? { error: part.errorText } : part.output} />
            ) : isInputReady ? (
              <div className="text-[11px] italic" style={{ color: "var(--fg-subtle)" }}>
                실행 중…
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function StatusDot({ state }: { state: ToolPart["state"] }) {
  const color =
    state === "output-error"
      ? "var(--danger)"
      : state === "output-available"
      ? "var(--success)"
      : "var(--highlight)";
  const pulse = state === "input-streaming" || state === "input-available";
  return (
    <span
      className={["inline-block h-2 w-2 rounded-full", pulse ? "animate-pulse" : ""].join(" ")}
      style={{ background: color, boxShadow: `0 0 0 3px ${pulse ? "var(--highlight-subtle)" : "transparent"}` }}
    />
  );
}

function ResultSummary({ part }: { part: ToolPart }) {
  if (part.state === "input-streaming") {
    return <span className="font-mono text-[10.5px]" style={{ color: "var(--fg-subtle)" }}>입력 작성 중…</span>;
  }
  if (part.state === "input-available") {
    return <span className="font-mono text-[10.5px]" style={{ color: "var(--fg-subtle)" }}>실행 중…</span>;
  }
  if (part.state === "output-error") {
    return <span className="font-mono text-[10.5px]" style={{ color: "var(--danger)" }}>실패</span>;
  }
  const summary = summarizeOutput(part.type, part.output);
  return summary ? (
    <span className="font-mono text-[10.5px] tabular-nums" style={{ color: "var(--fg-muted)" }}>
      {summary}
    </span>
  ) : null;
}

function summarizeOutput(type: string, output: unknown): string | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  if (Array.isArray(o.results)) return `${o.results.length} hits`;
  if (Array.isArray(o.releases)) return `${o.releases.length} releases`;
  if (Array.isArray(o.snippets)) return `${o.snippets.length} snippets`;
  if (Array.isArray(o.leftResults) && Array.isArray(o.rightResults)) {
    return `L:${(o.leftResults as unknown[]).length} R:${(o.rightResults as unknown[]).length}`;
  }
  if (Array.isArray(o.breakdown)) return `${o.breakdown.length} tags`;
  if (Array.isArray(o.docs)) return `${o.docs.length} docs`;
  if (typeof o.error === "string") return "error";
  return null;
}

function PayloadBlock({
  label,
  value,
  streaming,
}: {
  label: string;
  value: unknown;
  streaming?: boolean;
}) {
  const pretty = formatValue(value);
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--fg-subtle)" }}>
          {label}
        </span>
        {streaming ? (
          <span className="inline-block h-1 w-1 animate-pulse rounded-full" style={{ background: "var(--highlight)" }} />
        ) : null}
      </div>
      <pre
        className="overflow-x-auto whitespace-pre-wrap"
        style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "8px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          lineHeight: 1.55,
          color: "var(--fg-muted)",
          maxHeight: 240,
        }}
      >
        {pretty || (streaming ? "…" : "(empty)")}
      </pre>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    const json = JSON.stringify(v, null, 2);
    return json.length > 4000 ? json.slice(0, 4000) + "\n…(truncated)" : json;
  } catch {
    return String(v);
  }
}
