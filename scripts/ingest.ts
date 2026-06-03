import "dotenv/config";
import pLimit from "p-limit";
import { openDb, initSchema, closeDb } from "../lib/db/sqlite";
import { createEmbeddings, embeddingToBuffer } from "../lib/ai/embeddings";
import { fetchAndExtract } from "../lib/ingest/fetch";
import { chunkMarkdown } from "../lib/ingest/chunk";
import { SEEDS, type Seed } from "./seeds";

const CONCURRENT_FETCHES = 4;
const EMBED_BATCH = 64;

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing. Set it in .env.");
  }

  const db = openDb("readwrite");
  initSchema(db);

  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlyTag = onlyArg ? onlyArg.split("=")[1] : null;
  const seeds = onlyTag ? SEEDS.filter((s) => s.tag === onlyTag) : SEEDS;
  console.log(`[ingest] processing ${seeds.length} seeds${onlyTag ? ` (tag=${onlyTag})` : ""}`);

  const limit = pLimit(CONCURRENT_FETCHES);
  const fetched = await Promise.all(
    seeds.map((seed) =>
      limit(async () => {
        try {
          const t0 = Date.now();
          const doc = await fetchAndExtract(seed.url);
          const ms = Date.now() - t0;
          console.log(`[fetch ok] ${seed.tier}/${seed.tag} ${ms}ms ${doc.markdown.length}c ${seed.url}`);
          return { seed, doc };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[fetch fail] ${seed.url} :: ${msg}`);
          return null;
        }
      }),
    ),
  );

  const ok = fetched.filter((x): x is { seed: Seed; doc: Awaited<ReturnType<typeof fetchAndExtract>> } => x !== null);

  type Pending = { seed: Seed; docId: number; chunkIndex: number; content: string; tokenEst: number };
  const pending: Pending[] = [];

  const insertDoc = db.prepare(
    `INSERT INTO documents (url, source_type, source_tag, title, fetched_at, raw_length)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       title = excluded.title,
       fetched_at = excluded.fetched_at,
       raw_length = excluded.raw_length
     RETURNING id`,
  );
  const deleteOldChunks = db.prepare(`DELETE FROM chunks WHERE document_id = ?`);

  const tx = db.transaction(() => {
    for (const { seed, doc } of ok) {
      const chunks = chunkMarkdown(doc.markdown);
      if (chunks.length === 0) continue;
      const row = insertDoc.get(doc.url, seed.tier, seed.tag, doc.title, Date.now(), doc.markdown.length) as { id: number };
      deleteOldChunks.run(row.id);
      for (const ch of chunks) {
        pending.push({ seed, docId: row.id, chunkIndex: ch.index, content: ch.content, tokenEst: ch.tokenEst });
      }
    }
  });
  tx();
  console.log(`[ingest] prepared ${pending.length} chunks across ${ok.length} docs`);

  if (pending.length === 0) {
    console.log("[ingest] nothing to embed");
    closeDb();
    return;
  }

  const insertChunk = db.prepare(
    `INSERT INTO chunks (document_id, chunk_index, content, token_est) VALUES (?, ?, ?, ?)
     RETURNING id`,
  );
  const insertVec = db.prepare(`INSERT INTO vec_chunks(rowid, embedding) VALUES (?, ?)`);
  const wipeVec = db.prepare(`DELETE FROM vec_chunks`);

  // vec0 의 rowid 가 chunks.id 와 한 묶음으로 가야 한다.
  // chunks 가 새로 만들어지면 vec_chunks 도 비우고 다시 채운다 (가장 단순·정확).
  wipeVec.run();

  let totalCost = 0;
  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const batch = pending.slice(i, i + EMBED_BATCH);
    const t0 = Date.now();
    const vectors = await createEmbeddings(batch.map((p) => p.content));
    const ms = Date.now() - t0;
    const tokens = batch.reduce((s, p) => s + p.tokenEst, 0);
    const cost = (tokens / 1_000_000) * 0.02; // text-embedding-3-small $0.02 / 1M tokens
    totalCost += cost;
    console.log(`[embed] batch ${i}..${i + batch.length} (${ms}ms, ~${tokens} tok, $${cost.toFixed(5)})`);

    const writeBatch = db.transaction(() => {
      for (let j = 0; j < batch.length; j++) {
        const info = insertChunk.run(
          batch[j].docId,
          batch[j].chunkIndex,
          batch[j].content,
          batch[j].tokenEst,
        );
        const id = Number(info.lastInsertRowid);
        if (!Number.isInteger(id) || id <= 0) {
          throw new Error(`bad chunk id: ${String(info.lastInsertRowid)} (type=${typeof info.lastInsertRowid})`);
        }
        insertVec.run(BigInt(id), embeddingToBuffer(vectors[j]));
      }
    });
    writeBatch();
  }

  const docCount = db.prepare(`SELECT COUNT(*) AS n FROM documents`).get() as { n: number };
  const chunkCount = db.prepare(`SELECT COUNT(*) AS n FROM chunks`).get() as { n: number };
  const vecCount = db.prepare(`SELECT COUNT(*) AS n FROM vec_chunks`).get() as { n: number };
  console.log(
    `[ingest done] docs=${docCount.n} chunks=${chunkCount.n} vectors=${vecCount.n} est_cost=$${totalCost.toFixed(4)}`,
  );
  closeDb();
}

main().catch((err) => {
  console.error("[ingest] FATAL", err);
  process.exit(1);
});
