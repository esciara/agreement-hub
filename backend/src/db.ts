import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure the data directory exists at runtime
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'clm.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Run schema migration (idempotent)
db.exec(`
  CREATE TABLE IF NOT EXISTS contracts (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('draft','active','expired','terminated')) DEFAULT 'draft',
    created_at    TEXT NOT NULL,
    content       TEXT NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at DESC);
`);

export default db;
