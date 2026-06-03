"use client";

import type { CharacterConfig } from "@/lib/ai/prompts";

export function CharacterCard({ character }: { character: CharacterConfig }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div
          className="grid h-9 w-9 place-items-center rounded-[10px] font-mono text-[15px] font-semibold"
          style={{ background: "var(--surface-2)", color: "var(--fg)" }}
        >
          §
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
            {character.name}
          </div>
          <div
            className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.1em]"
            style={{ color: "var(--fg-subtle)" }}
          >
            RAG · v0.1
          </div>
        </div>
      </div>

      <p className="text-[13px] leading-[1.55]" style={{ color: "var(--fg-muted)" }}>
        {character.description}.
      </p>
    </section>
  );
}
