import { tool } from "ai";
import { z } from "zod";
import { runRag } from "@/lib/rag/orchestrate";
import { hybridSearch } from "@/lib/rag/search";
import { openDb } from "@/lib/db/sqlite";
import { fetchAndExtract } from "@/lib/ingest/fetch";
import { chunkMarkdown } from "@/lib/ingest/chunk";

const DAY = 24 * 60 * 60 * 1000;

/* ─────────────────────────────────────────────────────────────────────
 * rag_search
 *   내부 RAG 인덱스(SQLite + sqlite-vec + FTS5)에서 하이브리드 검색.
 *   HyDE 쿼리 재작성 + 멀티쿼리 + RRF 결과 반환.
 * ──────────────────────────────────────────────────────────────────── */
const ragSearch = tool({
  description: [
    "내부 RAG 인덱스에서 하이브리드(벡터+BM25) 검색을 수행한다.",
    "",
    "WHEN to call:",
    "  - 사용자가 AI 코딩 도구·LLM API·플랫폼(Claude Code, Cursor, Codex, Aider, Windsurf, Cline, Zed, Anthropic, OpenAI, Gemini, Vercel, Railway, Threads API, X API)의 기능·사용법·설정·가격·changelog 를 물을 때",
    "  - 답변에 *공식 근거*가 필요할 때 (인용 [1][2]…)",
    "  - 도구 비교·trade-off 질문 — 한 도구씩 따로 검색해서 자료를 모은다",
    "",
    "WHY first:",
    "  - 학습 컷오프 이후 변경된 API 시그니처·가격·기능을 잡기 위함",
    "  - 답변에 url 출처를 붙여 검증 가능하게 하기 위함",
    "",
    "HOW to use well:",
    "  - 질문 그대로 넣지 말고, 구체적 키워드 형태로 변형 (예: 'cursor agent rules best practices', 'gemini api pricing flash 2.0')",
    "  - 결과가 부족하면 다른 키워드로 다시 호출 (호출 횟수 제한 없음)",
    "  - topK 는 보통 6. 비교 질문이면 8 까지 늘려도 됨",
    "  - 한 질문에 여러 측면이 있으면 측면 별로 따로 호출 (예: 가격·기능·예시 각각)",
  ].join("\n"),
  inputSchema: z.object({
    query: z
      .string()
      .min(2)
      .describe(
        "구체적 영어 키워드 phrase. 도구 이름·기능 이름·API 엔드포인트 포함 권장. 예: 'claude code mcp server hooks', 'openai responses api streaming function calling'.",
      ),
    topK: z
      .number()
      .int()
      .min(2)
      .max(12)
      .optional()
      .describe("반환할 chunk 수. 기본 6. 비교 질문이면 8~10."),
  }),
  execute: async ({ query, topK }) => {
    try {
      const result = await runRag(query);
      const limited = result.chunks.slice(0, topK ?? 6);
      return {
        query,
        rewrite: result.rewrite,
        results: limited.map((c) => ({
          n: c.chunkId,
          title: c.title,
          url: c.url,
          tag: c.sourceTag,
          type: c.sourceType,
          score: Number(c.score.toFixed(3)),
          snippet: c.content.slice(0, 500),
        })),
      };
    } catch (err) {
      return { query, error: err instanceof Error ? err.message : String(err), results: [] };
    }
  },
});

/* ─────────────────────────────────────────────────────────────────────
 * fetch_url
 *   사용자가 특정 URL 을 가리키거나, RAG 결과의 출처를 더 깊이 파야 할 때.
 * ──────────────────────────────────────────────────────────────────── */
const fetchUrl = tool({
  description: [
    "특정 URL 의 본문을 *실시간으로* fetch + readability 추출 + 청킹해서 발췌를 반환한다.",
    "",
    "WHEN to call:",
    "  - 사용자가 URL 을 직접 제시하며 '이거 봐줘' / '이 페이지 요약' 한 경우",
    "  - rag_search 결과에 정확한 답이 안 보이고, 특정 출처 url 의 본문 전체를 확인해야 할 때",
    "  - 사용자가 최신 changelog / release notes 의 *원문 확인* 을 요청한 경우",
    "",
    "WHY:",
    "  - RAG 인덱스에 아직 없는 새 페이지를 그 자리에서 가져올 수 있음",
    "  - 청크가 잘린 부분이 답에 필요할 때 원문에서 직접 확인 가능",
    "",
    "HOW:",
    "  - 결과의 snippets 는 4개·각 800자. 핵심 발췌만 포함",
    "  - 401/403/봇 차단된 사이트는 실패. 그럴 땐 사용자에게 '이 사이트는 봇 차단됨' 솔직히 말함",
  ].join("\n"),
  inputSchema: z.object({
    url: z.string().url().describe("http(s) URL"),
  }),
  execute: async ({ url }) => {
    try {
      const doc = await fetchAndExtract(url);
      if (!doc.markdown || doc.markdown.length < 200) {
        return { url, error: "본문 추출 실패 (너무 짧음)", snippets: [] };
      }
      const truncated = doc.markdown.slice(0, 600_000);
      const chunks = chunkMarkdown(truncated);
      return {
        url,
        title: doc.title,
        lastModified: doc.lastModified ?? null,
        rawLength: doc.markdown.length,
        chunkCount: chunks.length,
        snippets: chunks.slice(0, 4).map((c) => c.content.slice(0, 800)),
      };
    } catch (err) {
      return { url, error: err instanceof Error ? err.message : String(err), snippets: [] };
    }
  },
});

/* ─────────────────────────────────────────────────────────────────────
 * web_search (Tavily, graceful fallback)
 * ──────────────────────────────────────────────────────────────────── */
const webSearch = tool({
  description: [
    "외부 웹 검색(Tavily). 우리 인덱스에 *없는* 정보를 가져온다.",
    "",
    "WHEN to call:",
    "  - rag_search 가 빈손이거나, 사용자가 '최근 24시간 뉴스' 같은 *극최신* 정보를 요구할 때",
    "  - 우리 인덱스 범위 밖 (예: 새로 나온 도구, 특정 회사 채용 공고, 최근 사고) 인 경우",
    "",
    "WHY last:",
    "  - 외부 API 호출이라 latency 와 비용이 발생",
    "  - 내부 RAG 가 더 통제된 출처라 신뢰도 ↑",
    "",
    "HOW:",
    "  - 영어 키워드 쿼리. 시간 제약은 query 안에 포함 (예: 'cursor 2026 changelog')",
    "  - TAVILY_API_KEY 가 서버에 없으면 자동으로 비활성. 그때는 사용자에게 '웹 검색 비활성' 명시",
  ].join("\n"),
  inputSchema: z.object({
    query: z.string().min(2),
    maxResults: z.number().int().min(1).max(8).optional(),
  }),
  execute: async ({ query, maxResults }) => {
    const key = process.env.TAVILY_API_KEY;
    if (!key) {
      return { query, disabled: true, reason: "TAVILY_API_KEY 미설정", results: [] };
    }
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: "basic",
          max_results: maxResults ?? 5,
        }),
      });
      if (!res.ok) return { query, error: `HTTP ${res.status}`, results: [] };
      const data = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
      return {
        query,
        results: (data.results ?? []).map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content.slice(0, 600),
        })),
      };
    } catch (err) {
      return { query, error: err instanceof Error ? err.message : String(err), results: [] };
    }
  },
});

/* ─────────────────────────────────────────────────────────────────────
 * list_recent_releases
 *   DB 의 changelog 소스에서 최근 fetched_at 순으로 doc 메타 반환.
 * ──────────────────────────────────────────────────────────────────── */
const listRecentReleases = tool({
  description: [
    "내부 인덱스의 changelog/release-notes 카테고리 문서를 fetched_at 최신순으로 나열한다.",
    "",
    "WHEN to call:",
    "  - 사용자가 '이번 주 / 이번 달 / 최근 업데이트' 같은 시간 기반 질문",
    "  - 도구별 changelog 를 비교할 때 ('aider 와 cursor 둘 다 최근 변화?')",
    "",
    "WHY:",
    "  - rag_search 는 의미 검색이라 시간 정렬이 약함. changelog 메타로 *시간순* 정렬이 정확",
    "",
    "HOW:",
    "  - tag 로 도구 필터 (예: 'cursor', 'aider'). 미지정시 전체",
    "  - limit 기본 8. 한 도구 살필 땐 4 정도",
    "  - 결과는 메타만 반환. 본문이 필요하면 rag_search 또는 fetch_url 로 다시 호출",
  ].join("\n"),
  inputSchema: z.object({
    tag: z.string().optional().describe("선택적 source_tag 필터 (예: 'cursor', 'aider')"),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  execute: async ({ tag, limit }) => {
    try {
      const db = openDb("readonly");
      const sql = tag
        ? `SELECT url, title, source_tag, fetched_at, last_modified FROM documents
           WHERE source_type = 'changelog' AND source_tag = ?
           ORDER BY COALESCE(last_modified, fetched_at) DESC LIMIT ?`
        : `SELECT url, title, source_tag, fetched_at, last_modified FROM documents
           WHERE source_type = 'changelog'
           ORDER BY COALESCE(last_modified, fetched_at) DESC LIMIT ?`;
      const rows = tag
        ? (db.prepare(sql).all(tag, limit ?? 8) as Row[])
        : (db.prepare(sql).all(limit ?? 8) as Row[]);
      return { tag: tag ?? null, releases: rows.map(toFreshness) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), releases: [] };
    }
  },
});

/* ─────────────────────────────────────────────────────────────────────
 * compare_tools
 *   2개 도구의 자료를 동시에 모아 비교 컨텍스트 생성.
 * ──────────────────────────────────────────────────────────────────── */
const compareTools = tool({
  description: [
    "두 도구를 *동시에* 검색해서 비교용 자료를 한 번에 반환한다.",
    "",
    "WHEN to call:",
    "  - 'X vs Y' 또는 'X 와 Y 의 차이' 같은 비교 질문",
    "  - rag_search 를 두 번 호출하기보다 이걸로 한 번에 처리",
    "",
    "WHY:",
    "  - 각 도구의 같은 측면(가격/기능/UX)을 균형 있게 가져오기 위함",
    "  - rag_search 호출이 양쪽 균등하게 분포되도록 강제",
    "",
    "HOW:",
    "  - aspect 가 있으면 그 측면 위주로 쿼리 변형 (예: aspect='pricing' → 각 도구에 가격 쿼리)",
    "  - 결과는 leftTool / rightTool 두 묶음으로 분리되어 옴",
  ].join("\n"),
  inputSchema: z.object({
    leftTool: z.string().describe("예: 'Claude Code', 'Cursor'"),
    rightTool: z.string(),
    aspect: z
      .enum(["overview", "pricing", "features", "performance", "workflow", "agent_mode", "ide_integration", "tools_ecosystem"])
      .optional()
      .describe("비교 측면. 미지정 시 overview."),
  }),
  execute: async ({ leftTool, rightTool, aspect }) => {
    const aspectQ = aspectToQuery(aspect ?? "overview");
    try {
      const [left, right] = await Promise.all([
        hybridSearch(
          [
            { embedSeed: `${leftTool} ${aspectQ}`, termSeed: `${leftTool} ${aspectQ}` },
            { embedSeed: `${leftTool} documentation`, termSeed: leftTool },
          ],
          5,
        ),
        hybridSearch(
          [
            { embedSeed: `${rightTool} ${aspectQ}`, termSeed: `${rightTool} ${aspectQ}` },
            { embedSeed: `${rightTool} documentation`, termSeed: rightTool },
          ],
          5,
        ),
      ]);
      return {
        leftTool,
        rightTool,
        aspect: aspect ?? "overview",
        leftResults: left.map(toResultRow),
        rightResults: right.map(toResultRow),
      };
    } catch (err) {
      return {
        leftTool,
        rightTool,
        aspect: aspect ?? "overview",
        error: err instanceof Error ? err.message : String(err),
        leftResults: [],
        rightResults: [],
      };
    }
  },
});

/* ─────────────────────────────────────────────────────────────────────
 * find_code_examples
 *   특정 도구·API 의 *코드 예제* 가 들어간 chunk 만 우선적으로 검색.
 * ──────────────────────────────────────────────────────────────────── */
const findCodeExamples = tool({
  description: [
    "특정 도구/API 의 *실제 코드 예제* 를 들어가 있는 chunk 위주로 검색.",
    "",
    "WHEN to call:",
    "  - 사용자가 'how do I … in code', '예제 보여줘', 'curl 명령어', 'python 으로 호출' 같은 질문",
    "",
    "WHY:",
    "  - 일반 rag_search 는 설명 chunk 가 섞임. 코드 fence 가 포함된 chunk 만 거르면 답변 품질 ↑",
    "",
    "HOW:",
    "  - query 에 언어/엔드포인트 포함 (예: 'anthropic messages api python streaming')",
    "  - 결과는 코드 블록을 포함할 가능성이 높음. 답변에 그대로 인용 가능",
  ].join("\n"),
  inputSchema: z.object({
    query: z.string().min(2),
    language: z.enum(["python", "typescript", "javascript", "curl", "go", "rust", "any"]).optional(),
  }),
  execute: async ({ query, language }) => {
    try {
      const langTokens = language && language !== "any" ? ` ${language}` : "";
      const variants = [
        { embedSeed: `${query}${langTokens} code example snippet`, termSeed: `${query}${langTokens}` },
        { embedSeed: `${query} usage example`, termSeed: query },
      ];
      const results = await hybridSearch(variants, 10);
      const filtered = results
        .map((r) => ({
          row: r,
          codeScore:
            (r.content.match(/```/g)?.length ?? 0) +
            (r.content.match(/\n\s{4}/g)?.length ?? 0) * 0.1 +
            (/curl |fetch\(|import |def |const |let /.test(r.content) ? 1 : 0),
        }))
        .sort((a, b) => b.codeScore - a.codeScore)
        .slice(0, 6)
        .map(({ row, codeScore }) => ({ ...toResultRow(row), codeScore: Number(codeScore.toFixed(2)) }));
      return { query, language: language ?? "any", results: filtered };
    } catch (err) {
      return { query, error: err instanceof Error ? err.message : String(err), results: [] };
    }
  },
});

/* ─────────────────────────────────────────────────────────────────────
 * freshness_check
 *   특정 source_tag 또는 url 의 fetched_at·last_modified 를 확인.
 * ──────────────────────────────────────────────────────────────────── */
const freshnessCheck = tool({
  description: [
    "내부 인덱스의 자료가 얼마나 신선한지 확인. fetched_at·last_modified 기준 일수 반환.",
    "",
    "WHEN to call:",
    "  - 사용자가 '이 정보 최신이야?' / '언제 자료야?' 물을 때",
    "  - 답변 끝에 'fresh / stale' 메타 정보를 붙여주고 싶을 때",
    "",
    "WHY:",
    "  - RAG 답변의 *시점 신뢰도* 를 투명하게 만들어 줌",
    "",
    "HOW:",
    "  - tag 또는 url 한쪽 지정",
    "  - 결과: ageDays(일수), isFresh(<= 14d), staleness label",
  ].join("\n"),
  inputSchema: z.object({
    tag: z.string().optional(),
    url: z.string().optional(),
  }),
  execute: async ({ tag, url }) => {
    if (!tag && !url) return { error: "tag 또는 url 중 하나 필요" };
    try {
      const db = openDb("readonly");
      const rows = url
        ? (db
            .prepare(
              `SELECT url, title, source_tag, fetched_at, last_modified FROM documents WHERE url = ?`,
            )
            .all(url) as Row[])
        : (db
            .prepare(
              `SELECT url, title, source_tag, fetched_at, last_modified FROM documents WHERE source_tag = ? ORDER BY fetched_at DESC LIMIT 20`,
            )
            .all(tag) as Row[]);
      return { tag: tag ?? null, url: url ?? null, docs: rows.map(toFreshness) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), docs: [] };
    }
  },
});

/* ─────────────────────────────────────────────────────────────────────
 * list_tags
 *   사용자가 "지금 인덱스에 어떤 자료들 있어?" 물을 때.
 * ──────────────────────────────────────────────────────────────────── */
const listTags = tool({
  description: [
    "현재 RAG 인덱스에 들어있는 source_tag 별 문서·청크 수를 반환.",
    "",
    "WHEN to call:",
    "  - 사용자가 '어떤 자료들 다 가지고 있어?', '커버 범위 보여줘' 등을 물을 때",
    "  - 답변 전에 인덱스 범위를 점검하고 싶을 때",
    "",
    "WHY:",
    "  - 사용자에게 시스템의 한계와 강점을 투명하게 보여줌",
    "",
    "HOW:",
    "  - 인자 없음. 항상 전체 catalog 반환",
  ].join("\n"),
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const db = openDb("readonly");
      const rows = db
        .prepare(
          `SELECT source_tag AS tag, source_type AS type, COUNT(*) AS docs FROM documents
           GROUP BY source_tag, source_type ORDER BY docs DESC`,
        )
        .all() as { tag: string; type: string; docs: number }[];
      const totals = db.prepare(`SELECT COUNT(*) AS docs FROM documents`).get() as { docs: number };
      const chunks = db.prepare(`SELECT COUNT(*) AS chunks FROM chunks`).get() as { chunks: number };
      return { totals, chunkCount: chunks.chunks, breakdown: rows };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), breakdown: [] };
    }
  },
});

// ─── helpers ────────────────────────────────────────────────────────

type Row = {
  url: string;
  title: string | null;
  source_tag: string | null;
  fetched_at: number;
  last_modified: number | null;
};

function toFreshness(r: Row) {
  const ts = r.last_modified ?? r.fetched_at;
  const ageDays = Math.round((Date.now() - ts) / DAY);
  const staleness = ageDays <= 14 ? "fresh" : ageDays <= 60 ? "recent" : ageDays <= 180 ? "stale" : "archive";
  return {
    url: r.url,
    title: r.title,
    tag: r.source_tag,
    fetchedAt: r.fetched_at,
    lastModified: r.last_modified,
    ageDays,
    staleness,
  };
}

function toResultRow(c: {
  chunkId: number;
  title: string | null;
  url: string | null;
  sourceTag: string | null;
  sourceType: string | null;
  score: number;
  content: string;
}) {
  return {
    n: c.chunkId,
    title: c.title,
    url: c.url,
    tag: c.sourceTag,
    type: c.sourceType,
    score: Number(c.score.toFixed(3)),
    snippet: c.content.slice(0, 500),
  };
}

function aspectToQuery(a: string): string {
  switch (a) {
    case "pricing":
      return "pricing cost plan usage limits";
    case "features":
      return "features capabilities supported";
    case "performance":
      return "performance latency benchmark speed";
    case "workflow":
      return "workflow usage best practices";
    case "agent_mode":
      return "agent mode autonomous multi-step";
    case "ide_integration":
      return "ide editor integration extension";
    case "tools_ecosystem":
      return "tool ecosystem integrations mcp plugins";
    default:
      return "overview introduction what is";
  }
}

export const stackSageTools = {
  rag_search: ragSearch,
  fetch_url: fetchUrl,
  web_search: webSearch,
  list_recent_releases: listRecentReleases,
  compare_tools: compareTools,
  find_code_examples: findCodeExamples,
  freshness_check: freshnessCheck,
  list_tags: listTags,
};
