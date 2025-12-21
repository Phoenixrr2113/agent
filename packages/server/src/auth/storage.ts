import { createHash, randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';

import type { ApiKeyStorage } from './types.js';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS api_keys (
    key_hash TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_used_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_api_keys_created_at
    ON api_keys(created_at);
`;

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function generateKey(): string {
  return `ak_${randomBytes(24).toString('hex')}`;
}

export function createApiKeyStorage(dbPath: string): ApiKeyStorage {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);

  const validateStmt = db.prepare('SELECT key_hash FROM api_keys WHERE key_hash = ?');
  const updateLastUsedStmt = db.prepare('UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?');
  const insertStmt = db.prepare('INSERT INTO api_keys (key_hash, name, created_at) VALUES (?, ?, ?)');
  const listStmt = db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC');
  const revokeStmt = db.prepare('DELETE FROM api_keys WHERE key_hash = ?');

  return {
    async validate(key: string): Promise<string | null> {
      const keyHash = hashKey(key);
      const row = validateStmt.get(keyHash) as { key_hash: string } | undefined;
      if (row) {
        updateLastUsedStmt.run(new Date().toISOString(), keyHash);
        return keyHash;
      }
      return null;
    },

    async create(name: string): Promise<{ key: string; keyHash: string }> {
      const key = generateKey();
      const keyHash = hashKey(key);
      insertStmt.run(keyHash, name, new Date().toISOString());
      return { key, keyHash };
    },

    async list(): Promise<Array<{ keyHash: string; name: string; createdAt: Date; lastUsedAt: Date | null }>> {
      const rows = listStmt.all() as Array<{
        key_hash: string;
        name: string;
        created_at: string;
        last_used_at: string | null;
      }>;
      return rows.map(row => ({
        keyHash: row.key_hash,
        name: row.name,
        createdAt: new Date(row.created_at),
        lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
      }));
    },

    async revoke(keyHash: string): Promise<boolean> {
      const result = revokeStmt.run(keyHash);
      return result.changes > 0;
    },

    async updateLastUsed(keyHash: string): Promise<void> {
      updateLastUsedStmt.run(new Date().toISOString(), keyHash);
    },

    async close(): Promise<void> {
      db.close();
    },
  };
}
