import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pLimit from "p-limit";
import { openDb, initSchema, closeDb } from "../lib/db/sqlite";
import { createEmbeddings, embeddingToBuffer } from "../lib/ai/embeddings";
import { fetchAndExtract } from "../lib/ingest/fetch";
import { fetchSitemap } from "../lib/ingest/sitemap";
import { chunkMarkdown } from "../lib/ingest/chunk";
import { SEEDS, type Seed, type UrlSeed } from "./seeds";

const RAW_DIR = path.join(process.cwd(), "data", "raw");

const CONCURRENT_FETCHES = 6;
const EMBED_BATCH = 64;
const FETCH_MIN_CHARS = 200;

async function expandSeeds(seeds: Seed[]): Promise<UrlSeed[]> {
  const out: UrlSeed[] = [];
  const seen = new Set<string>();
  for (const seed of seeds) {
    if (seed.kind === "url") {
      if (!seen.has(seed.url)) {
        seen.add(seed.url);
        out.push(seed);
      }
      continue;
    }
    try {
      const entries = await fetchSitemap(seed.sitemap);
      const filtered = entries
        .filter((e) => (seed.include ? seed.include.test(e.loc) : true))
        .slice(0, seed.maxUrls ?? 40);
      console.log(`[sitemap] ${seed.tag} ${entries.length} → ${filtered.length} after filter`);
      for (const e of filtered) {
        if (seen.has(e.loc)) continue;
        seen.add(e.loc);
        out.push({ kind: "url", url: e.loc, tier: seed.tier, tag: seed.tag });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[sitemap fail] ${seed.sitemap} :: ${msg}`);
    }
  }
  return out;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing. Set it in .env.");
  }

  const db = openDb("readwrite");
  initSchema(db);

  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlyTag = onlyArg ? onlyArg.split("=")[1] : null;
  const selectedSeeds = onlyTag ? SEEDS.filter((s) => s.tag === onlyTag) : SEEDS;

  console.log(`[ingest] expanding ${selectedSeeds.length} seed entries (incl. sitemaps)...`);
  const seeds = await expandSeeds(selectedSeeds);
  console.log(`[ingest] processing ${seeds.length} concrete URLs${onlyTag ? ` (tag=${onlyTag})` : ""}`);

  const limit = pLimit(CONCURRENT_FETCHES);
  const fetched = await Promise.all(
    seeds.map((seed) =>
      limit(async () => {
        try {
          const t0 = Date.now();
          const doc = await fetchAndExtract(seed.url);
          const ms = Date.now() - t0;
          if (!doc.markdown || doc.markdown.length < FETCH_MIN_CHARS) {
            console.warn(`[fetch thin] ${seed.tier}/${seed.tag} ${doc.markdown.length}c ${seed.url}`);
            return null;
          }
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

  const ok = fetched.filter((x): x is { seed: UrlSeed; doc: Awaited<ReturnType<typeof fetchAndExtract>> } => x !== null);

  type Pending = { seed: UrlSeed; docId: number; chunkIndex: number; content: string; tokenEst: number };
  const pending: Pending[] = [];

  const insertDoc = db.prepare(
    `INSERT INTO documents (url, source_type, source_tag, title, fetched_at, last_modified, raw_length)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       title = excluded.title,
       fetched_at = excluded.fetched_at,
       last_modified = excluded.last_modified,
       raw_length = excluded.raw_length
     RETURNING id`,
  );
  const deleteOldChunks = db.prepare(`DELETE FROM chunks WHERE document_id = ?`);

  fs.mkdirSync(RAW_DIR, { recursive: true });

  const tx = db.transaction(() => {
    for (const { seed, doc } of ok) {
      const chunks = chunkMarkdown(doc.markdown, doc.title);
      if (chunks.length === 0) continue;
      dumpRaw(seed, doc);
      const row = insertDoc.get(
        doc.url,
        seed.tier,
        seed.tag,
        doc.title,
        Date.now(),
        doc.lastModified ?? null,
        doc.markdown.length,
      ) as { id: number | bigint };
      const docId = Number(row.id);
      deleteOldChunks.run(docId);
      for (const ch of chunks) {
        pending.push({ seed, docId, chunkIndex: ch.index, content: ch.content, tokenEst: ch.tokenEst });
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
    `INSERT INTO chunks (document_id, chunk_index, content, token_est) VALUES (?, ?, ?, ?)`,
  );
  const insertVec = db.prepare(`INSERT INTO vec_chunks(rowid, embedding) VALUES (?, ?)`);
  const wipeVec = db.prepare(`DELETE FROM vec_chunks`);
  wipeVec.run();

  let totalCost = 0;
  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const batch = pending.slice(i, i + EMBED_BATCH);
    const t0 = Date.now();
    const vectors = await createEmbeddings(batch.map((p) => p.content));
    const ms = Date.now() - t0;
    const tokens = batch.reduce((s, p) => s + p.tokenEst, 0);
    const cost = (tokens / 1_000_000) * 0.02;
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
        insertVec.run(BigInt(id), embeddingToBuffer(vectors[j]));
      }
    });
    writeBatch();
  }

  const docCount = db.prepare(`SELECT COUNT(*) AS n FROM documents`).get() as { n: number };
  const chunkCount = db.prepare(`SELECT COUNT(*) AS n FROM chunks`).get() as { n: number };
  const vecCount = db.prepare(`SELECT COUNT(*) AS n FROM vec_chunks`).get() as { n: number };
  const tagBreakdown = db
    .prepare(
      `SELECT source_tag AS tag, COUNT(*) AS docs FROM documents GROUP BY source_tag ORDER BY docs DESC`,
    )
    .all() as { tag: string; docs: number }[];
  console.log(
    `[ingest done] docs=${docCount.n} chunks=${chunkCount.n} vectors=${vecCount.n} est_cost=$${totalCost.toFixed(4)}`,
  );
  console.log("[ingest tags]", tagBreakdown.slice(0, 20).map((t) => `${t.tag}:${t.docs}`).join(" "));
  closeDb();
}

function dumpRaw(seed: UrlSeed, doc: { url: string; title: string; markdown: string; lastModified?: number }) {
  const tagDir = path.join(RAW_DIR, sanitize(seed.tag));
  fs.mkdirSync(tagDir, { recursive: true });
  const slug = urlToSlug(doc.url);
  const file = path.join(tagDir, `${slug}.md`);
  const header = [
    `<!-- url: ${doc.url} -->`,
    `<!-- title: ${doc.title.replace(/-->/g, "")} -->`,
    `<!-- tier: ${seed.tier} -->`,
    `<!-- tag: ${seed.tag} -->`,
    `<!-- fetched_at: ${new Date().toISOString()} -->`,
    doc.lastModified ? `<!-- last_modified: ${new Date(doc.lastModified).toISOString()} -->` : "",
    "",
    `# ${doc.title}`,
    "",
  ].filter(Boolean).join("\n");
  fs.writeFileSync(file, header + doc.markdown, "utf8");
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

function urlToSlug(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+|\/+$/g, "") || "index";
    const search = u.search ? "_" + u.search.slice(1).replace(/[=&]/g, "_") : "";
    return sanitize(`${u.host}_${path}${search}`).slice(0, 100) || "page";
  } catch {
    return sanitize(url).slice(0, 100);
  }
}

main().catch((err) => {
  console.error("[ingest] FATAL", err);
  process.exit(1);
});
