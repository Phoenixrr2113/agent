import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

import type {
  ProfileStorageAdapter,
  UserProfile,
  ProfilePreference,
  ProfileUpdate,
  PreferenceCategory,
  ToolHint,
} from './types.js';

function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS profile_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    confidence REAL NOT NULL,
    source TEXT NOT NULL,
    extracted_at TEXT NOT NULL,
    valid_from TEXT NOT NULL,
    invalidated_at TEXT,
    superseded_by TEXT,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
  );

  CREATE TABLE IF NOT EXISTS preference_tool_hints (
    id TEXT PRIMARY KEY,
    preference_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    actions TEXT,
    reminder_template TEXT NOT NULL,
    FOREIGN KEY (preference_id) REFERENCES profile_preferences(id)
  );

  CREATE INDEX IF NOT EXISTS idx_preferences_user
    ON profile_preferences(user_id);
  CREATE INDEX IF NOT EXISTS idx_preferences_active
    ON profile_preferences(user_id, invalidated_at);
  CREATE INDEX IF NOT EXISTS idx_preferences_category
    ON profile_preferences(user_id, category, invalidated_at);
  CREATE INDEX IF NOT EXISTS idx_tool_hints_preference
    ON preference_tool_hints(preference_id);
  CREATE INDEX IF NOT EXISTS idx_tool_hints_tool
    ON preference_tool_hints(tool_name);
`;

export function createProfileStorage(dbPath: string): ProfileStorageAdapter {
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);

  const parsePreference = (row: any, toolHints: ToolHint[] = []): ProfilePreference => ({
    id: row.id,
    content: row.content,
    category: row.category as PreferenceCategory,
    confidence: row.confidence,
    source: row.source,
    toolHints,
    extractedAt: new Date(row.extracted_at),
    validFrom: new Date(row.valid_from),
    invalidatedAt: row.invalidated_at ? new Date(row.invalidated_at) : null,
    supersededBy: row.superseded_by || null,
  });

  const getToolHintsForPreference = (preferenceId: string): ToolHint[] => {
    const rows = db.prepare(
      'SELECT tool_name, actions, reminder_template FROM preference_tool_hints WHERE preference_id = ?'
    ).all(preferenceId) as any[];

    return rows.map(row => ({
      toolName: row.tool_name,
      actions: safeJsonParse<string[]>(row.actions, []),
      reminderTemplate: row.reminder_template,
    }));
  };

  const insertPreference = db.prepare(`
    INSERT INTO profile_preferences
    (id, user_id, content, category, confidence, source, extracted_at, valid_from, invalidated_at, superseded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertToolHint = db.prepare(`
    INSERT INTO preference_tool_hints (id, preference_id, tool_name, actions, reminder_template)
    VALUES (?, ?, ?, ?, ?)
  `);

  const invalidatePreference = db.prepare(`
    UPDATE profile_preferences
    SET invalidated_at = ?, superseded_by = ?
    WHERE id = ?
  `);

  const updateProfileVersion = db.prepare(`
    UPDATE user_profiles
    SET updated_at = ?, version = version + 1
    WHERE user_id = ?
  `);

  return {
    async getProfile(userId: string): Promise<UserProfile | null> {
      const row = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId) as any;
      if (!row) return null;

      const preferences = await this.getActivePreferences(userId);

      return {
        userId: row.user_id,
        preferences,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        version: row.version,
      };
    },

    async createProfile(userId: string): Promise<UserProfile> {
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO user_profiles (user_id, created_at, updated_at, version)
        VALUES (?, ?, ?, 1)
      `).run(userId, now, now);

      return {
        userId,
        preferences: [],
        createdAt: new Date(now),
        updatedAt: new Date(now),
        version: 1,
      };
    },

    async updateProfile(userId: string, update: ProfileUpdate): Promise<UserProfile> {
      const now = new Date().toISOString();

      const transaction = db.transaction(() => {
        for (const inv of update.invalidations) {
          invalidatePreference.run(now, inv.supersededBy || null, inv.id);
        }

        for (const upd of update.updates) {
          const newId = randomUUID();

          const oldRow = db.prepare(
            'SELECT * FROM profile_preferences WHERE id = ?'
          ).get(upd.id) as any;

          if (oldRow) {
            invalidatePreference.run(now, newId, upd.id);

            insertPreference.run(
              newId,
              userId,
              upd.newContent,
              oldRow.category,
              oldRow.confidence,
              upd.source,
              now,
              now,
              null,
              null
            );

            const oldHints = getToolHintsForPreference(upd.id);
            for (const hint of oldHints) {
              insertToolHint.run(
                randomUUID(),
                newId,
                hint.toolName,
                JSON.stringify(hint.actions),
                hint.reminderTemplate
              );
            }
          }
        }

        for (const add of update.additions) {
          const prefId = randomUUID();

          insertPreference.run(
            prefId,
            userId,
            add.content,
            add.category,
            add.confidence,
            add.source,
            now,
            now,
            null,
            null
          );

          for (const hint of add.toolHints) {
            insertToolHint.run(
              randomUUID(),
              prefId,
              hint.toolName,
              JSON.stringify(hint.actions),
              hint.reminderTemplate
            );
          }
        }

        updateProfileVersion.run(now, userId);
      });

      transaction();

      const profile = await this.getProfile(userId);
      if (!profile) {
        throw new Error(`Profile not found after update: ${userId}`);
      }
      return profile;
    },

    async getActivePreferences(userId: string): Promise<ProfilePreference[]> {
      const rows = db.prepare(`
        SELECT * FROM profile_preferences
        WHERE user_id = ? AND invalidated_at IS NULL
        ORDER BY confidence DESC
      `).all(userId) as any[];

      return rows.map(row => {
        const toolHints = getToolHintsForPreference(row.id);
        return parsePreference(row, toolHints);
      });
    },

    async getPreferencesByCategory(
      userId: string,
      category: PreferenceCategory
    ): Promise<ProfilePreference[]> {
      const rows = db.prepare(`
        SELECT * FROM profile_preferences
        WHERE user_id = ? AND category = ? AND invalidated_at IS NULL
        ORDER BY confidence DESC
      `).all(userId, category) as any[];

      return rows.map(row => {
        const toolHints = getToolHintsForPreference(row.id);
        return parsePreference(row, toolHints);
      });
    },

    async getPreferencesForTool(
      userId: string,
      toolName: string,
      action?: string
    ): Promise<ProfilePreference[]> {
      const rows = db.prepare(`
        SELECT DISTINCT p.*, h.actions, h.reminder_template as hint_template
        FROM profile_preferences p
        JOIN preference_tool_hints h ON h.preference_id = p.id
        WHERE p.user_id = ?
          AND p.invalidated_at IS NULL
          AND h.tool_name = ?
        ORDER BY p.confidence DESC
      `).all(userId, toolName) as any[];

      const results: ProfilePreference[] = [];

      for (const row of rows) {
        const actions = safeJsonParse<string[]>(row.actions, []);

        if (action && actions.length > 0 && !actions.includes(action)) {
          continue;
        }

        const toolHints = getToolHintsForPreference(row.id);
        results.push(parsePreference(row, toolHints));
      }

      return results;
    },

    async close(): Promise<void> {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {
        // Ignore if already closed
      }
      db.close();
    },
  };
}
