import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

let database: DatabaseSync | undefined;

export function getDatabase() {
  if (database) return database;

  const configuredPath = process.env.NITRO_DATABASE_PATH || "./data/scrapflow.db";
  const databasePath = resolve(configuredPath);
  mkdirSync(dirname(databasePath), { recursive: true });

  database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'yard_manager', 'scale_operator')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
      created_at TEXT NOT NULL,
      approved_at TEXT,
      approved_by TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
  `);

  return database;
}
