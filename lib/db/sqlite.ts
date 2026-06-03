import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

export type DbMode = "readwrite" | "readonly";

const DB_FILENAME = "rag.db";

function resolveDbPath(): string {
  if (process.env.RAG_DB_PATH) return process.env.RAG_DB_PATH;

  const candidates = [
    // Vercel: traced data file ends up under the function root
    path.join(process.cwd(), "data", DB_FILENAME),
    // Some runtimes execute from .next/standalone
    path.join(process.cwd(), ".next", "server", "data", DB_FILENAME),
    // Build-output absolute fallback (Vercel function bundle)
    "/var/task/data/" + DB_FILENAME,
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0]; // 첫 후보로 throw 시 메시지에 노출
}

let cached: Database.Database | null = null;
let cachedMode: DbMode | null = null;

export function openDb(mode: DbMode = "readonly"): Database.Database {
  if (cached && cachedMode === mode) return cached;
  if (cached) {
    cached.close();
    cached = null;
  }

  const dbPath = resolveDbPath();
  if (mode === "readonly" && !fs.existsSync(dbPath)) {
    let listing = "";
    try {
      const dir = path.dirname(dbPath);
      listing = `(cwd=${process.cwd()}, dir=${dir}, dirExists=${fs.existsSync(dir)})`;
    } catch {}
    throw new Error(
      `rag.db not found at ${dbPath} ${listing}. Build pipeline likely failed to bundle the SQLite asset.`,
    );
  }
  if (mode === "readwrite") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath, {
    readonly: mode === "readonly",
    fileMustExist: mode === "readonly",
  });
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  sqliteVec.load(db);

  cached = db;
  cachedMode = mode;
  return db;
}

export function closeDb(): void {
  if (cached) {
    cached.close();
    cached = null;
    cachedMode = null;
  }
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  url           TEXT UNIQUE,
  source_type   TEXT NOT NULL,
  source_tag    TEXT,
  title         TEXT,
  fetched_at    INTEGER NOT NULL,
  last_modified INTEGER,
  raw_length    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  token_est    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
  embedding float[1536]
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5(
  content,
  content='chunks',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO fts_chunks(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO fts_chunks(fts_chunks, rowid, content) VALUES('delete', old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO fts_chunks(fts_chunks, rowid, content) VALUES('delete', old.id, old.content);
  INSERT INTO fts_chunks(rowid, content) VALUES (new.id, new.content);
END;
`;

export function initSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}
