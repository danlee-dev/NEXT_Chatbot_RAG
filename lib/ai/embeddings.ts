import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

export async function createEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({
    model: openai.embedding(EMBEDDING_MODEL),
    values: texts,
  });
  return embeddings;
}

/**
 * sqlite-vec는 Float32Array의 raw bytes를 BLOB으로 받는다.
 * JSON 직렬화보다 4배 빠르고 저장 공간도 작다.
 */
export function embeddingToBuffer(v: number[]): Buffer {
  const f32 = new Float32Array(v);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}
