"use client";

import { useState } from "react";
import type { SessionSource } from "@/components/Chat";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function IngestPanel({
  sessionSources,
  onAdd,
  onRemove,
}: {
  sessionSources: SessionSource[];
  onAdd: (s: SessionSource) => void;
  onRemove: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const canSubmit = /^https?:\/\//i.test(url.trim()) && status.kind !== "loading";

  async function handleAdd() {
    if (!canSubmit) return;
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? "알 수 없는 오류" });
        return;
      }
      onAdd(data.source as SessionSource);
      setUrl("");
      setStatus({ kind: "ok" });
      setTimeout(() => setStatus({ kind: "idle" }), 1800);
    } catch {
      setStatus({ kind: "error", message: "네트워크 오류" });
    }
  }

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <h3
          className="text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--fg-subtle)" }}
        >
          세션 소스
        </h3>
        <span className="font-mono text-[10.5px]" style={{ color: "var(--fg-subtle)" }}>
          {sessionSources.length}
        </span>
      </div>

      <div
        className="flex items-center gap-1 p-1.5"
        style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)" }}
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… URL 추가"
          className="block w-full border-0 bg-transparent px-2 text-[12.5px] outline-none"
          style={{ color: "var(--fg)" }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          disabled={status.kind === "loading"}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canSubmit}
          className="shrink-0 rounded-[6px] px-2 py-1 font-mono text-[11px] transition"
          style={{
            background: canSubmit ? "var(--accent)" : "transparent",
            color: canSubmit ? "var(--accent-fg)" : "var(--fg-subtle)",
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {status.kind === "loading" ? "…" : "add"}
        </button>
      </div>

      {status.kind === "error" ? (
        <div className="text-[11.5px]" style={{ color: "var(--danger)" }}>
          {status.message}
        </div>
      ) : null}

      {sessionSources.length === 0 ? (
        <p className="text-[11.5px] leading-snug" style={{ color: "var(--fg-subtle)" }}>
          URL 을 추가하면 그 페이지의 발췌가 다음 답변에 함께 반영된다. 세션 동안만 유지.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {sessionSources.map((s) => (
            <li
              key={s.url}
              className="group flex items-center justify-between gap-2 px-2.5 py-2"
              style={{ background: "var(--surface-2)", borderRadius: "var(--r-md)" }}
            >
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[12px] font-medium"
                  style={{ color: "var(--fg)" }}
                  title={s.title ?? s.url}
                >
                  {s.title ?? s.url}
                </div>
                <div
                  className="truncate font-mono text-[10.5px]"
                  style={{ color: "var(--fg-subtle)" }}
                >
                  {hostOf(s.url)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(s.url)}
                aria-label="제거"
                className="shrink-0 font-mono text-[12px] opacity-50 transition hover:opacity-100"
                style={{ color: "var(--fg-muted)" }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
