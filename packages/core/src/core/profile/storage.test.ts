import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createProfileStorage } from './storage.js';
import type { ProfileStorageAdapter, ProfileUpdate } from './types.js';

describe('Profile Storage', () => {
  const testDbPath = path.join(process.cwd(), 'test-profile-storage.db');
  let storage: ProfileStorageAdapter;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    storage = createProfileStorage(testDbPath);
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

  describe('createProfile', () => {
    it('should create a new user profile', async () => {
      const profile = await storage.createProfile('user-1');

      expect(profile.userId).toBe('user-1');
      expect(profile.preferences).toEqual([]);
      expect(profile.version).toBe(1);
      expect(profile.createdAt).toBeInstanceOf(Date);
      expect(profile.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error when creating duplicate profile', async () => {
      await storage.createProfile('user-1');

      await expect(storage.createProfile('user-1')).rejects.toThrow();
    });
  });

  describe('getProfile', () => {
    it('should return null for non-existent profile', async () => {
      const profile = await storage.getProfile('nonexistent');
      expect(profile).toBeNull();
    });

    it('should return existing profile with preferences', async () => {
      await storage.createProfile('user-1');

      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Uses TypeScript',
            category: 'technology',
            confidence: 0.9,
            source: 'User said: I always use TypeScript',
            toolHints: [],
          },
        ],
        updates: [],
        invalidations: [],
      };

      await storage.updateProfile('user-1', update);

      const profile = await storage.getProfile('user-1');
      expect(profile).not.toBeNull();
      expect(profile!.preferences).toHaveLength(1);
      expect(profile!.preferences[0].content).toBe('Uses TypeScript');
    });
  });

  describe('updateProfile', () => {
    it('should add new preferences', async () => {
      await storage.createProfile('user-1');

      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Prefers concise responses',
            category: 'communication',
            confidence: 0.85,
            source: 'User said: Keep it short',
            toolHints: [
              {
                toolName: 'delegate',
                actions: [],
                reminderTemplate: 'Keep responses concise',
              },
            ],
          },
        ],
        updates: [],
        invalidations: [],
      };

      const updated = await storage.updateProfile('user-1', update);

      expect(updated.preferences).toHaveLength(1);
      expect(updated.preferences[0].content).toBe('Prefers concise responses');
      expect(updated.preferences[0].toolHints).toHaveLength(1);
      expect(updated.preferences[0].toolHints[0].toolName).toBe('delegate');
      expect(updated.version).toBe(2);
    });

    it('should update existing preference', async () => {
      await storage.createProfile('user-1');

      const initialUpdate: ProfileUpdate = {
        additions: [
          {
            content: 'Uses npm',
            category: 'workflow',
            confidence: 0.8,
            source: 'User said: npm install',
            toolHints: [],
          },
        ],
        updates: [],
        invalidations: [],
      };

      const initial = await storage.updateProfile('user-1', initialUpdate);
      const prefId = initial.preferences[0].id;

      const secondUpdate: ProfileUpdate = {
        additions: [],
        updates: [
          {
            id: prefId,
            newContent: 'Uses pnpm instead of npm',
            source: 'User said: I switched to pnpm',
          },
        ],
        invalidations: [],
      };

      const final = await storage.updateProfile('user-1', secondUpdate);

      expect(final.preferences).toHaveLength(1);
      expect(final.preferences[0].content).toBe('Uses pnpm instead of npm');
    });

    it('should invalidate preference', async () => {
      await storage.createProfile('user-1');

      const initialUpdate: ProfileUpdate = {
        additions: [
          {
            content: 'Uses vim',
            category: 'technology',
            confidence: 0.7,
            source: 'User said: I use vim',
            toolHints: [],
          },
        ],
        updates: [],
        invalidations: [],
      };

      const initial = await storage.updateProfile('user-1', initialUpdate);
      const prefId = initial.preferences[0].id;

      const invalidateUpdate: ProfileUpdate = {
        additions: [],
        updates: [],
        invalidations: [
          {
            id: prefId,
            reason: 'User switched to VSCode',
          },
        ],
      };

      const final = await storage.updateProfile('user-1', invalidateUpdate);

      expect(final.preferences).toHaveLength(0);
    });
  });

  describe('getActivePreferences', () => {
    it('should only return active preferences', async () => {
      await storage.createProfile('user-1');

      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Preference 1',
            category: 'general',
            confidence: 0.9,
            source: 'test',
            toolHints: [],
          },
          {
            content: 'Preference 2',
            category: 'general',
            confidence: 0.8,
            source: 'test',
            toolHints: [],
          },
        ],
        updates: [],
        invalidations: [],
      };

      const initial = await storage.updateProfile('user-1', update);

      const invalidateUpdate: ProfileUpdate = {
        additions: [],
        updates: [],
        invalidations: [
          {
            id: initial.preferences[0].id,
            reason: 'No longer valid',
          },
        ],
      };

      await storage.updateProfile('user-1', invalidateUpdate);

      const active = await storage.getActivePreferences('user-1');
      expect(active).toHaveLength(1);
      expect(active[0].content).toBe('Preference 2');
    });

    it('should sort by confidence descending', async () => {
      await storage.createProfile('user-1');

      const update: ProfileUpdate = {
        additions: [
          { content: 'Low conf', category: 'general', confidence: 0.3, source: 'test', toolHints: [] },
          { content: 'High conf', category: 'general', confidence: 0.9, source: 'test', toolHints: [] },
          { content: 'Med conf', category: 'general', confidence: 0.6, source: 'test', toolHints: [] },
        ],
        updates: [],
        invalidations: [],
      };

      await storage.updateProfile('user-1', update);

      const active = await storage.getActivePreferences('user-1');
      expect(active[0].content).toBe('High conf');
      expect(active[1].content).toBe('Med conf');
      expect(active[2].content).toBe('Low conf');
    });
  });

  describe('getPreferencesByCategory', () => {
    it('should filter by category', async () => {
      await storage.createProfile('user-1');

      const update: ProfileUpdate = {
        additions: [
          { content: 'Tech pref', category: 'technology', confidence: 0.8, source: 'test', toolHints: [] },
          { content: 'Comm pref', category: 'communication', confidence: 0.8, source: 'test', toolHints: [] },
          { content: 'Tech pref 2', category: 'technology', confidence: 0.7, source: 'test', toolHints: [] },
        ],
        updates: [],
        invalidations: [],
      };

      await storage.updateProfile('user-1', update);

      const techPrefs = await storage.getPreferencesByCategory('user-1', 'technology');
      expect(techPrefs).toHaveLength(2);
      expect(techPrefs.every(p => p.category === 'technology')).toBe(true);
    });
  });

  describe('getPreferencesForTool', () => {
    it('should return preferences with matching tool hints', async () => {
      await storage.createProfile('user-1');

      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Use TypeScript for all files',
            category: 'coding_style',
            confidence: 0.9,
            source: 'test',
            toolHints: [
              { toolName: 'fs', actions: ['write', 'edit'], reminderTemplate: 'Use .ts extension' },
            ],
          },
          {
            content: 'Use pnpm',
            category: 'workflow',
            confidence: 0.8,
            source: 'test',
            toolHints: [
              { toolName: 'shell', actions: [], reminderTemplate: 'Use pnpm not npm' },
            ],
          },
          {
            content: 'No tool hint',
            category: 'general',
            confidence: 0.7,
            source: 'test',
            toolHints: [],
          },
        ],
        updates: [],
        invalidations: [],
      };

      await storage.updateProfile('user-1', update);

      const fsPrefs = await storage.getPreferencesForTool('user-1', 'fs');
      expect(fsPrefs).toHaveLength(1);
      expect(fsPrefs[0].content).toBe('Use TypeScript for all files');
    });

    it('should filter by action when specified', async () => {
      await storage.createProfile('user-1');

      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Preference with specific actions',
            category: 'coding_style',
            confidence: 0.9,
            source: 'test',
            toolHints: [
              { toolName: 'fs', actions: ['write'], reminderTemplate: 'Reminder for write only' },
            ],
          },
        ],
        updates: [],
        invalidations: [],
      };

      await storage.updateProfile('user-1', update);

      const writePrefs = await storage.getPreferencesForTool('user-1', 'fs', 'write');
      expect(writePrefs).toHaveLength(1);

      const readPrefs = await storage.getPreferencesForTool('user-1', 'fs', 'read');
      expect(readPrefs).toHaveLength(0);
    });
  });
});
