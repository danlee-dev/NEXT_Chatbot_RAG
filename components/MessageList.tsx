"use client";

import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { ToolCard } from "@/components/ToolCard";

const FOLLOWUPS = [
  "방금 답변 출처 [1] 자세히 보여줘",
  "다른 도구와 trade-off 비교해줘",
  "이걸 한국 스타트업 환경에 맞게 다시 추천해줘",
];

export function MessageList({
  messages,
  isStreaming,
  isSubmitted,
  onCitationClick,
  onSuggestionClick,
}: {
  messages: UIMessage[];
  isStreaming: boolean;
  isSubmitted: boolean;
  onCitationClick: (n: number) => void;
  onSuggestionClick: (text: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, isSubmitted]);

  if (messages.length === 0) {
    return <EmptyState onSuggestionClick={onSuggestionClick} />;
  }

  const last = messages[messages.length - 1];
  // assistant 메시지가 아직 시작 안 됐을 때 (status submitted) thinking placeholder.
  const needsPlaceholder = (isSubmitted || isStreaming) && last?.role === "user";

  return (
    <div className="flex flex-col gap-6">
      {messages.map((m) => (
        <Bubble key={m.id} message={m} onCitationClick={onCitationClick} />
      ))}
      {needsPlaceholder ? <ThinkingPlaceholder /> : null}

      {!isStreaming && !isSubmitted && last?.role === "assistant" ? (
        <FollowupRow onPick={onSuggestionClick} />
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}

function ThinkingPlaceholder() {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="flex gap-3"
    >
      <div
        aria-hidden
        className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-[10px] font-mono text-[12px] font-semibold"
        style={{ background: "var(--bg-subtle)", color: "var(--fg)", border: "1px solid var(--border)" }}
      >
        S
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
            Stack Sage
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-subtle)" }}>
            thinking
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
          <span className="inline-flex gap-[3px]">
            <Dot delay="0ms" />
            <Dot delay="120ms" />
            <Dot delay="240ms" />
          </span>
          <RotatingHint />
        </div>
      </div>
    </motion.div>
  );
}

function RotatingHint() {
  const hints = [
    "질문 의도 파악 중",
    "검색 키워드 재작성 중",
    "RAG 인덱스 탐색 중",
    "근거 자료 모으는 중",
    "답변 구성 중",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % hints.length), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={i}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -3 }}
        transition={{ duration: 0.18 }}
      >
        {hints[i]}…
      </motion.span>
    </AnimatePresence>
  );
}

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (t: string) => void }) {
  const ideas = [
    "Cursor vs Claude Code, 큰 리팩터에 뭐가 나아?",
    "Aider 가 잘 어울리는 워크플로우는?",
    "Codex CLI 최근 changelog 요약",
    "SWE-bench 상위권 에이전트 현황",
  ];
  return (
    <div className="flex h-full flex-col items-start justify-center gap-6 py-10">
      <div className="space-y-2">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--fg-subtle)" }}
        >
          Stack Sage
        </div>
        <h1
          className="text-[28px] font-semibold leading-[1.15] tracking-tight"
          style={{ color: "var(--fg)" }}
        >
          AI 코딩 에이전트, <br />
          <span style={{ color: "var(--fg-muted)" }}>지금 내 상황엔 뭘 쓸까.</span>
        </h1>
        <p className="max-w-[480px] text-[13.5px] leading-[1.6]" style={{ color: "var(--fg-muted)" }}>
          Claude Code · Cursor · Codex CLI · Aider · Windsurf · Cline · Zed AI 의 공식 docs,
          최신 changelog, 평론, 벤치마크, 커뮤니티 토론을 한 RAG 인덱스에 모았다. 결론 먼저,
          근거는 옆 패널에서.
        </p>
      </div>

      <div className="grid w-full max-w-[560px] grid-cols-1 gap-2 sm:grid-cols-2">
        {ideas.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onSuggestionClick(q)}
            className="group surface-subtle flex items-center justify-between gap-2 px-3 py-2.5 text-left text-[12.5px] transition"
            style={{ color: "var(--fg)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            }}
          >
            <span className="leading-snug">{q}</span>
            <span
              aria-hidden
              className="font-mono text-[11px] opacity-0 transition group-hover:opacity-100"
              style={{ color: "var(--fg-subtle)" }}
            >
              ↵
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

type AnyPart = {
  type: string;
  text?: string;
  state?: "input-streaming" | "input-available" | "output-available" | "output-error";
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function Bubble({
  message,
  onCitationClick,
}: {
  message: UIMessage;
  onCitationClick: (n: number) => void;
}) {
  const isUser = message.role === "user";
  const parts = (message.parts ?? []) as AnyPart[];

  if (isUser) {
    const text = parts.filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className="flex justify-end"
      >
        <div
          className="max-w-[78%] whitespace-pre-wrap break-words text-[14px] leading-[1.55]"
          style={{
            background: "var(--bg-subtle)",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            borderBottomRightRadius: 10,
            padding: "10px 14px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {text}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="flex gap-3"
    >
      <div
        aria-hidden
        className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-[10px] font-mono text-[12px] font-semibold"
        style={{ background: "var(--bg-subtle)", color: "var(--fg)", border: "1px solid var(--border)" }}
      >
        S
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
            Stack Sage
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-subtle)" }}>
            assistant
          </span>
        </div>

        <AnimatePresence initial={false}>
          {parts.map((part, i) => {
            if (part.type === "text") {
              return (
                <motion.div
                  key={`text-${i}`}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[14px] leading-[1.65]"
                  style={{ color: "var(--fg)" }}
                >
                  <RichText text={part.text ?? ""} onCitationClick={onCitationClick} />
                </motion.div>
              );
            }
            if (part.type === "reasoning" && typeof part.text === "string") {
              return (
                <ReasoningBlock key={`r-${i}`} text={part.text} />
              );
            }
            if (part.type.startsWith("tool-")) {
              return <ToolCard key={part.toolCallId ?? `t-${i}`} part={part} />;
            }
            return null;
          })}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

function ReasoningBlock({ text }: { text: string }) {
  return (
    <div
      className="text-[12px] leading-snug"
      style={{
        color: "var(--fg-subtle)",
        borderLeft: "2px solid var(--border-strong)",
        paddingLeft: 10,
        fontStyle: "italic",
      }}
    >
      {text}
    </div>
  );
}

/**
 * 마크다운 본문을 렌더 후, 모든 text node 에서 `[N]` 인용 패턴을
 * 클릭 가능한 citation chip 으로 deep 변환한다.
 */
function RichText({
  text,
  onCitationClick,
}: {
  text: string;
  onCitationClick: (n: number) => void;
}) {
  if (!text) return <span className="opacity-50">…</span>;
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p style={{ margin: "0 0 0.85em 0" }}>{injectChips(children, onCitationClick)}</p>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: "0 0 0.85em 0", paddingLeft: "1.2em", listStyle: "disc" }}>
              {injectChips(children, onCitationClick)}
            </ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: "0 0 0.85em 0", paddingLeft: "1.4em", listStyle: "decimal" }}>
              {injectChips(children, onCitationClick)}
            </ol>
          ),
          li: ({ children }) => (
            <li style={{ margin: "0.15em 0" }}>{injectChips(children, onCitationClick)}</li>
          ),
          h1: ({ children }) => (
            <h2
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                margin: "1.1em 0 0.4em 0",
              }}
            >
              {injectChips(children, onCitationClick)}
            </h2>
          ),
          h2: ({ children }) => (
            <h3
              style={{
                fontSize: "0.98rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                margin: "1.1em 0 0.4em 0",
              }}
            >
              {injectChips(children, onCitationClick)}
            </h3>
          ),
          h3: ({ children }) => (
            <h4
              style={{
                fontSize: "0.92rem",
                fontWeight: 700,
                margin: "0.9em 0 0.3em 0",
              }}
            >
              {injectChips(children, onCitationClick)}
            </h4>
          ),
          strong: ({ children }) => (
            <strong style={{ fontWeight: 700 }}>
              {injectChips(children, onCitationClick)}
            </strong>
          ),
          em: ({ children }) => (
            <em style={{ fontStyle: "italic" }}>
              {injectChips(children, onCitationClick)}
            </em>
          ),
          blockquote: ({ children }) => (
            <blockquote
              style={{
                margin: "0.6em 0",
                padding: "0.2em 0 0.2em 0.9em",
                borderLeft: "2px solid var(--border-strong)",
                color: "var(--fg-muted)",
              }}
            >
              {injectChips(children, onCitationClick)}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--highlight)", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              {injectChips(children, onCitationClick)}
            </a>
          ),
          hr: () => (
            <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "1em 0" }} />
          ),
          code: ({ className, children }) => {
            const isBlock = (className ?? "").includes("language-");
            if (isBlock) {
              return (
                <code style={{ display: "block", fontFamily: "var(--font-mono)" }}>
                  {children}
                </code>
              );
            }
            return (
              <code
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.875em",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  padding: "1px 5px",
                  borderRadius: 4,
                }}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre
              style={{
                margin: "0 0 0.85em 0",
                padding: "12px 14px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "auto",
                fontSize: "0.85em",
                lineHeight: 1.55,
                fontFamily: "var(--font-mono)",
              }}
            >
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div style={{ overflowX: "auto", margin: "0 0 0.85em 0" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  fontSize: "0.9em",
                  width: "100%",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead style={{ background: "var(--bg-subtle)" }}>{children}</thead>
          ),
          th: ({ children }) => (
            <th
              style={{
                textAlign: "left",
                padding: "7px 10px",
                fontWeight: 600,
                borderBottom: "1px solid var(--border)",
                color: "var(--fg)",
              }}
            >
              {injectChips(children, onCitationClick)}
            </th>
          ),
          td: ({ children }) => (
            <td
              style={{
                padding: "7px 10px",
                borderTop: "1px solid var(--border)",
                color: "var(--fg-muted)",
                verticalAlign: "top",
              }}
            >
              {injectChips(children, onCitationClick)}
            </td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/**
 * children 트리를 깊이 우선으로 traversal 하면서 string 내의 [N] 패턴을
 * citation chip 컴포넌트로 교체한다.
 */
function injectChips(
  children: ReactNode,
  onCitationClick: (n: number) => void,
): ReactNode {
  return Children.map(children, (child, idx) => {
    if (typeof child === "string") {
      return splitCitations(child, onCitationClick, idx);
    }
    if (isValidElement<{ children?: ReactNode }>(child)) {
      const props = child.props;
      if (props && props.children !== undefined) {
        return cloneElement(child, undefined, injectChips(props.children, onCitationClick));
      }
    }
    return child;
  });
}

function splitCitations(
  text: string,
  onCitationClick: (n: number) => void,
  parentIdx: number,
): ReactNode {
  if (!text.includes("[")) return text;
  const out: ReactNode[] = [];
  const regex = /\[(\d{1,2})\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const n = Number(m[1]);
    out.push(
      <button
        key={`cite-${parentIdx}-${k++}`}
        type="button"
        className="citation-chip"
        onClick={() => onCitationClick(n)}
        aria-label={`source ${n}, click to inspect`}
      >
        {n}
      </button>,
    );
    last = regex.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 pl-9 text-[12px]" style={{ color: "var(--fg-subtle)" }}>
      <span className="inline-flex gap-[3px]">
        <Dot delay="0ms" />
        <Dot delay="120ms" />
        <Dot delay="240ms" />
      </span>
      thinking…
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full"
      style={{ background: "var(--fg-subtle)", animationDelay: delay }}
    />
  );
}

function FollowupRow({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 pl-9">
      {FOLLOWUPS.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onPick(q)}
          className="rounded-full border px-2.5 py-1 text-[11.5px] transition"
          style={{
            color: "var(--fg-muted)",
            borderColor: "var(--border)",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-subtle)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
          }}
        >
          {q}
        </button>
      ))}
    </div>
  );
}
