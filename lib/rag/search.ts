import type Database from "better-sqlite3";
import { openDb } from "@/lib/db/sqlite";
import { embeddingToBuffer, createEmbeddings } from "@/lib/ai/embeddings";
import type { RetrievedChunk } from "./types";

const DENSE_LIMIT = 25;
const FTS_LIMIT = 25;
const RRF_K = 60;

type ChunkRow = {
  chunk_id: number;
  document_id: number;
  url: string | null;
  title: string | null;
  source_tag: string | null;
  source_type: string | null;
  content: string;
};

function loadChunks(db: Database.Database, ids: number[]): Map<number, ChunkRow> {
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT c.id AS chunk_id, c.document_id, d.url, d.title, d.source_tag, d.source_type, c.content
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.id IN (${placeholders})`,
    )
    .all(...ids) as ChunkRow[];
  return new Map(rows.map((r) => [r.chunk_id, r]));
}

function denseSearch(db: Database.Database, vector: number[]): { id: number; distance: number }[] {
  const rows = db
    .prepare(
      `SELECT rowid AS id, distance
       FROM vec_chunks
       WHERE embedding MATCH ?
       ORDER BY distance
       LIMIT ?`,
    )
    .all(embeddingToBuffer(vector), DENSE_LIMIT) as { id: number; distance: number }[];
  return rows;
}

function ftsSearch(db: Database.Database, terms: string): { id: number; score: number }[] {
  const sanitized = sanitizeFtsQuery(terms);
  if (!sanitized) return [];
  const rows = db
    .prepare(
      `SELECT rowid AS id, bm25(fts_chunks) AS score
       FROM fts_chunks
       WHERE fts_chunks MATCH ?
       ORDER BY score
       LIMIT ?`,
    )
    .all(sanitized, FTS_LIMIT) as { id: number; score: number }[];
  return rows;
}

function sanitizeFtsQuery(terms: string): string {
  const tokens = terms
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 40)
    .slice(0, 10);
  if (tokens.length === 0) return "";
  return tokens.map((t) => `"${t}"`).join(" OR ");
}

/** Reciprocal Rank Fusion — 여러 ranked list를 안정적으로 섞는 방법. */
function rrf(lists: { id: number; rank: number; bucket: string }[][]): Map<number, { score: number; vecRank?: number; ftsRank?: number }> {
  const scores = new Map<number, { score: number; vecRank?: number; ftsRank?: number }>();
  for (const list of lists) {
    for (const item of list) {
      const prev = scores.get(item.id) ?? { score: 0 };
      const inc = 1 / (RRF_K + item.rank);
      prev.score += inc;
      if (item.bucket === "vec") prev.vecRank = item.rank;
      if (item.bucket === "fts") prev.ftsRank = item.rank;
      scores.set(item.id, prev);
    }
  }
  return scores;
}

export type HybridQuery = {
  vectors: number[][];
  terms: string[];
};

/**
 * 멀티쿼리 + HyDE 임베딩들을 *전부* 던져넣고 RRF로 합친다.
 * 입력 vectors: HyDE + 각 query 변형의 dense vector.
 * 입력 terms: 원 질문 + query 변형들의 키워드.
 */
export function hybridSearchSync(
  db: Database.Database,
  query: HybridQuery,
  topK: number,
): RetrievedChunk[] {
  const lists: { id: number; rank: number; bucket: string }[][] = [];
  for (const vec of query.vectors) {
    const hits = denseSearch(db, vec);
    lists.push(hits.map((h, i) => ({ id: h.id, rank: i + 1, bucket: "vec" })));
  }
  for (const terms of query.terms) {
    const hits = ftsSearch(db, terms);
    lists.push(hits.map((h, i) => ({ id: h.id, rank: i + 1, bucket: "fts" })));
  }
  const fused = rrf(lists);
  const sorted = [...fused.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, topK);
  const ids = sorted.map(([id]) => id);
  const rows = loadChunks(db, ids);
  const out: RetrievedChunk[] = [];
  for (const [id, meta] of sorted) {
    const row = rows.get(id);
    if (!row) continue;
    out.push({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      url: row.url,
      title: row.title,
      sourceTag: row.source_tag,
      sourceType: row.source_type,
      content: row.content,
      score: meta.score,
      vecRank: meta.vecRank,
      ftsRank: meta.ftsRank,
    });
  }
  return out;
}

export async function hybridSearch(
  variants: { embedSeed: string; termSeed: string }[],
  topK = 6,
): Promise<RetrievedChunk[]> {
  const db = openDb("readonly");
  const seeds = variants.map((v) => v.embedSeed);
  const vectors = seeds.length > 0 ? await createEmbeddings(seeds) : [];
  const terms = variants.map((v) => v.termSeed);
  return hybridSearchSync(db, { vectors, terms }, topK);
}
