"use client";

import { useRef, useState, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { MAX_INPUT_CHARS } from "@/lib/utils/limits";

export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const isTooLong = value.length > MAX_INPUT_CHARS;
  const canSend = value.trim().length > 0 && !isTooLong && !disabled;

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="surface flex flex-col gap-2 px-3 pt-2.5 pb-2"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="질문을 입력하세요  ·  예) Cursor vs Claude Code, 큰 코드베이스 리팩터에 뭐가 나아?"
        className="block w-full resize-none border-0 bg-transparent text-[14px] leading-[1.55] outline-none"
        style={{ color: "var(--fg)", minHeight: "44px" }}
        disabled={disabled}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--fg-subtle)" }}>
          <span className="kbd">Enter</span>
          <span>전송</span>
          <span className="opacity-50">·</span>
          <span className="kbd">⇧ Enter</span>
          <span>줄바꿈</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-[11px] tabular-nums"
            style={{ color: isTooLong ? "var(--danger)" : "var(--fg-subtle)" }}
          >
            {value.length}<span className="opacity-50">/{MAX_INPUT_CHARS}</span>
          </span>
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-semibold tracking-tight transition"
            style={{
              background: canSend ? "var(--accent)" : "var(--bg-subtle)",
              color: canSend ? "var(--accent-fg)" : "var(--fg-subtle)",
              border: `1px solid ${canSend ? "transparent" : "var(--border)"}`,
              cursor: canSend ? "pointer" : "not-allowed",
            }}
            aria-label="전송"
          >
            {disabled ? (
              <>
                <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: "currentColor" }} />
                생성중
              </>
            ) : (
              <>
                Send
                <span aria-hidden style={{ fontSize: "11px", opacity: 0.7 }}>↵</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
