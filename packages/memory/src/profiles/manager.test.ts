import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createProfileStorage } from './storage.js';
import { createProfileManager } from './manager.js';
import type { ProfileStorageAdapter, ProfileManager, ProfileUpdate } from './types.js';

describe('Profile Manager', () => {
  const testDbPath = path.join(process.cwd(), 'test-profile-manager.db');
  let storage: ProfileStorageAdapter;
  let manager: ProfileManager;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    storage = createProfileStorage(testDbPath);
    manager = createProfileManager(storage);
  });

  afterEach(async () => {
    await storage.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    const walPath = `${testDbPath}-wal`;
    const shmPath = `${testDbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  describe('getOrCreateProfile', () => {
    it('should create profile if not exists', async () => {
      const profile = await manager.getOrCreateProfile('new-user');

      expect(profile.userId).toBe('new-user');
      expect(profile.preferences).toEqual([]);
    });

    it('should return existing profile', async () => {
      await storage.createProfile('existing-user');
      const update: ProfileUpdate = {
        additions: [
          { content: 'Test pref', category: 'general', confidence: 0.8, source: 'test', toolHints: [] },
        ],
        updates: [],
        invalidations: [],
      };
      await storage.updateProfile('existing-user', update);

      const profile = await manager.getOrCreateProfile('existing-user');

      expect(profile.userId).toBe('existing-user');
      expect(profile.preferences).toHaveLength(1);
    });
  });

  describe('formatForSystemPrompt', () => {
    it('should return empty string for no preferences', async () => {
      await storage.createProfile('user-1');

      const formatted = await manager.formatForSystemPrompt('user-1');

      expect(formatted).toBe('');
    });

    it('should format preferences by category', async () => {
      await storage.createProfile('user-1');

      const update: ProfileUpdate = {
        additions: [
          { content: 'Uses TypeScript', category: 'technology', confidence: 0.9, source: 'test', toolHints: [] },
          { content: 'Prefers concise responses', category: 'communication', confidence: 0.85, source: 'test', toolHints: [] },
          { content: 'Uses 2-space indentation', category: 'coding_style', confidence: 0.8, source: 'test', toolHints: [] },
        ],
        updates: [],
        invalidations: [],
      };
      await storage.updateProfile('user-1', update);

      const formatted = await manager.formatForSystemPrompt('user-1');

      expect(formatted).toContain('# User Preferences');
      expect(formatted).toContain('## Technology');
      expect(formatted).toContain('- Uses TypeScript');
      expect(formatted).toContain('## Communication');
      expect(formatted).toContain('- Prefers concise responses');
      expect(formatted).toContain('## Coding Style');
      expect(formatted).toContain('- Uses 2-space indentation');
    });

    it('should return empty for non-existent user', async () => {
      const formatted = await manager.formatForSystemPrompt('nonexistent');
      expect(formatted).toBe('');
    });

    it('should limit to top preferences by confidence', async () => {
      await storage.createProfile('user-1');

      const additions = Array.from({ length: 30 }, (_, i) => ({
        content: `Preference ${i}`,
        category: 'general' as const,
        confidence: i / 30,
        source: 'test',
        toolHints: [],
      }));

      await storage.updateProfile('user-1', { additions, updates: [], invalidations: [] });

      const formatted = await manager.formatForSystemPrompt('user-1');

      const matches = formatted.match(/- Preference/g) || [];
      expect(matches.length).toBeLessThanOrEqual(20);
    });
  });

  describe('getRemindersForTool', () => {
    it('should return reminders for matching tool', async () => {
      await storage.createProfile('user-1');

      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Use TypeScript',
            category: 'technology',
            confidence: 0.9,
            source: 'test',
            toolHints: [
              { toolName: 'fs', actions: ['write'], reminderTemplate: 'Use .ts extension' },
            ],
          },
        ],
        updates: [],
        invalidations: [],
      };
      await storage.updateProfile('user-1', update);

      const reminders = await manager.getRemindersForTool('user-1', 'fs', 'write');

      expect(reminders).toHaveLength(1);
      expect(reminders[0]).toBe('Use .ts extension');
    });

    it('should return empty array for no matching reminders', async () => {
      await storage.createProfile('user-1');

      const reminders = await manager.getRemindersForTool('user-1', 'web');

      expect(reminders).toEqual([]);
    });

    it('should filter by action', async () => {
      await storage.createProfile('user-1');

      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Pref with write action',
            category: 'coding_style',
            confidence: 0.9,
            source: 'test',
            toolHints: [
              { toolName: 'fs', actions: ['write'], reminderTemplate: 'Write reminder' },
            ],
          },
        ],
        updates: [],
        invalidations: [],
      };
      await storage.updateProfile('user-1', update);

      const writeReminders = await manager.getRemindersForTool('user-1', 'fs', 'write');
      expect(writeReminders).toHaveLength(1);

      const readReminders = await manager.getRemindersForTool('user-1', 'fs', 'read');
      expect(readReminders).toHaveLength(0);
    });

    it('should return reminder when actions array is empty (matches all actions)', async () => {
      await storage.createProfile('user-1');

      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Always use pnpm',
            category: 'workflow',
            confidence: 0.9,
            source: 'test',
            toolHints: [
              { toolName: 'shell', actions: [], reminderTemplate: 'Use pnpm not npm' },
            ],
          },
        ],
        updates: [],
        invalidations: [],
      };
      await storage.updateProfile('user-1', update);

      const reminders = await manager.getRemindersForTool('user-1', 'shell', 'npm');
      expect(reminders).toHaveLength(1);
      expect(reminders[0]).toBe('Use pnpm not npm');
    });

    it('should not duplicate reminders', async () => {
      await storage.createProfile('user-1');

      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Pref 1',
            category: 'coding_style',
            confidence: 0.9,
            source: 'test',
            toolHints: [
              { toolName: 'fs', actions: [], reminderTemplate: 'Same reminder' },
            ],
          },
          {
            content: 'Pref 2',
            category: 'coding_style',
            confidence: 0.8,
            source: 'test',
            toolHints: [
              { toolName: 'fs', actions: [], reminderTemplate: 'Same reminder' },
            ],
          },
        ],
        updates: [],
        invalidations: [],
      };
      await storage.updateProfile('user-1', update);

      const reminders = await manager.getRemindersForTool('user-1', 'fs');
      expect(reminders).toHaveLength(1);
    });
  });
});
