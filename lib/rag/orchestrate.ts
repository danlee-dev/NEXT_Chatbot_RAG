import { rewriteQuery } from "./rewrite";
import { hybridSearch } from "./search";
import type { RetrievedChunk } from "./types";

export type RagResult = {
  chunks: RetrievedChunk[];
  rewrite: {
    hyde: string;
    queries: string[];
  };
};

const TOP_K = 6;

export async function runRag(question: string): Promise<RagResult> {
  const rw = await rewriteQuery(question).catch(() => ({
    hyde: question,
    queries: [question],
  }));

  const variants: { embedSeed: string; termSeed: string }[] = [
    { embedSeed: rw.hyde, termSeed: question },
    { embedSeed: question, termSeed: question },
    ...rw.queries.map((q) => ({ embedSeed: q, termSeed: q })),
  ];

  const chunks = await hybridSearch(variants, TOP_K);
  return { chunks, rewrite: { hyde: rw.hyde, queries: rw.queries } };
}

export function buildRagContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const blocks = chunks.map((c, i) => {
    const head = `[${i + 1}] ${c.title ?? "(no title)"} — ${c.sourceTag ?? c.sourceType ?? ""}`;
    const link = c.url ? `URL: ${c.url}` : "";
    return [head, link, "", c.content].filter(Boolean).join("\n");
  });
  return [
    "# 근거 자료 (AI 코딩 도구 docs / changelogs / 평론 / 벤치 / 커뮤니티)",
    "",
    "아래 자료는 검색으로 찾아온 *최신 근거*다. 답변은 이 자료 안의 정보를 우선해서 작성하라.",
    "본문에서 자료를 참조할 때는 `[1]`, `[2]` 처럼 대괄호 번호로 인용하라.",
    "자료에 없는 내용을 만들어내지 말고, 모르면 모른다고 말하라.",
    "",
    blocks.join("\n\n---\n\n"),
  ].join("\n");
}
