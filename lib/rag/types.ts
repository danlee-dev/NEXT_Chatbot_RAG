export type RetrievedChunk = {
  chunkId: number;
  documentId: number;
  url: string | null;
  title: string | null;
  sourceTag: string | null;
  sourceType: string | null;
  content: string;
  score: number;
  vecRank?: number;
  ftsRank?: number;
};
