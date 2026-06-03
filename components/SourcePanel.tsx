"use client";

import { useState } from "react";
import type { SourceItem } from "@/components/Chat";

export function SourcePanel({
  sources,
  highlightN,
}: {
  sources: SourceItem[];
  highlightN: number | null;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
      <div className="flex items-baseline justify-between">
        <h3
          className="text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--fg-subtle)" }}
        >
          출처
        </h3>
        <span className="font-mono text-[10.5px]" style={{ color: "var(--fg-subtle)" }}>
          {sources.length}
        </span>
      </div>

      {sources.length === 0 ? (
        <div
          className="surface-subtle px-3 py-4 text-[11.5px] leading-snug"
          style={{ color: "var(--fg-subtle)" }}
        >
          답변이 도착하면 RAG 가 사용한 근거 chunk 가 여기 카드로 표시된다.
          본문의 <span className="citation-chip" aria-hidden>1</span> 같은 인용 번호를 누르면
          해당 카드로 스크롤된다.
        </div>
      ) : (
        <ul className="flex flex-col gap-2 overflow-y-auto pr-1">
          {sources.map((s) => (
            <SourceCard key={s.n} source={s} highlighted={s.n === highlightN} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SourceCard({ source, highlighted }: { source: SourceItem; highlighted: boolean }) {
  const [open, setOpen] = useState(false);
  const host = source.url ? safeHost(source.url) : null;

  return (
    <li
      id={`src-${source.n}`}
      className={highlighted ? "anim-pulse" : ""}
      style={{
        background: "var(--bg-elevated)",
        border: `1px solid ${highlighted ? "var(--highlight)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "10px 12px",
        transition: "border-color 200ms",
      }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-[1px] inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-full px-1 font-mono text-[10.5px] font-semibold"
          style={{
            background: highlighted ? "var(--highlight)" : "var(--highlight-subtle)",
            color: highlighted ? "var(--bg)" : "var(--highlight)",
          }}
        >
          {source.n}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[12.5px] font-semibold tracking-tight"
            style={{ color: "var(--fg)" }}
            title={source.title ?? source.url ?? ""}
          >
            {source.title ?? "(no title)"}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px]" style={{ color: "var(--fg-subtle)" }}>
            {source.tag ? <Badge>{source.tag}</Badge> : null}
            {host ? <span className="truncate">{host}</span> : null}
            {source.score > 0 ? <span className="opacity-60">· {source.score.toFixed(2)}</span> : null}
          </div>
        </div>
      </div>

      <p
        className={[
          "mt-2 text-[12.5px] leading-[1.55]",
          open ? "" : "line-clamp-3",
        ].join(" ")}
        style={{ color: "var(--fg-muted)", whiteSpace: "pre-wrap" }}
      >
        {source.content}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] font-medium tracking-tight transition"
          style={{ color: "var(--fg-muted)" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--fg)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)")}
        >
          {open ? "접기" : "더 보기"}
        </button>
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-medium tracking-tight transition"
            style={{ color: "var(--highlight)" }}
          >
            원문 ↗
          </a>
        ) : null}
      </div>
    </li>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-[4px] px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-[0.06em]"
      style={{ background: "var(--bg-subtle)", color: "var(--fg-muted)" }}
    >
      {children}
    </span>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
