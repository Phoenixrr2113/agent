import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createProfileStorage } from './storage.js';
import { createProfileManager } from './manager.js';
import { createToolReminderWrapper } from './tool-wrapper.js';
import type { ProfileStorageAdapter, ProfileManager, ProfileUpdate } from './types.js';

describe('Tool Reminder Wrapper', () => {
  const testDbPath = path.join(process.cwd(), 'test-tool-wrapper.db');
  let storage: ProfileStorageAdapter;
  let manager: ProfileManager;

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    storage = createProfileStorage(testDbPath);
    manager = createProfileManager(storage);
    await storage.createProfile('test-user');
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

  describe('wrapTools', () => {
    it('should wrap tools with execute functions', async () => {
      const tools = {
        testTool: {
          name: 'testTool',
          description: 'A test tool',
          execute: async () => 'original result',
        },
      };

      const wrapper = createToolReminderWrapper(manager, 'test-user');
      const wrapped = wrapper.wrapTools(tools);

      expect(wrapped.testTool).toBeDefined();
      expect(wrapped.testTool.name).toBe('testTool');
    });

    it('should preserve non-tool objects', async () => {
      const tools = {
        config: { value: 123 },
        nullItem: null,
      };

      const wrapper = createToolReminderWrapper(manager, 'test-user');
      const wrapped = wrapper.wrapTools(tools);

      expect(wrapped.config).toEqual({ value: 123 });
      expect(wrapped.nullItem).toBeNull();
    });

    it('should inject reminders into string results', async () => {
      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Use TypeScript',
            category: 'technology',
            confidence: 0.9,
            source: 'test',
            toolHints: [
              { toolName: 'testTool', actions: [], reminderTemplate: 'Remember to use TypeScript' },
            ],
          },
        ],
        updates: [],
        invalidations: [],
      };
      await storage.updateProfile('test-user', update);

      const tools = {
        testTool: {
          name: 'testTool',
          execute: async () => 'File written successfully',
        },
      };

      const wrapper = createToolReminderWrapper(manager, 'test-user');
      const wrapped = wrapper.wrapTools(tools);

      const result = await wrapped.testTool.execute({});

      expect(result).toContain('File written successfully');
      expect(result).toContain('<system-reminder>Remember to use TypeScript</system-reminder>');
    });

    it('should not modify non-string results', async () => {
      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Pref',
            category: 'general',
            confidence: 0.9,
            source: 'test',
            toolHints: [
              { toolName: 'testTool', actions: [], reminderTemplate: 'Some reminder' },
            ],
          },
        ],
        updates: [],
        invalidations: [],
      };
      await storage.updateProfile('test-user', update);

      const objectResult = { success: true, data: [1, 2, 3] };
      const tools = {
        testTool: {
          name: 'testTool',
          execute: async () => objectResult,
        },
      };

      const wrapper = createToolReminderWrapper(manager, 'test-user');
      const wrapped = wrapper.wrapTools(tools);

      const result = await wrapped.testTool.execute({});

      expect(result).toEqual(objectResult);
    });

    it('should not add reminders when none match', async () => {
      const tools = {
        testTool: {
          name: 'testTool',
          execute: async () => 'Result without reminders',
        },
      };

      const wrapper = createToolReminderWrapper(manager, 'test-user');
      const wrapped = wrapper.wrapTools(tools);

      const result = await wrapped.testTool.execute({});

      expect(result).toBe('Result without reminders');
      expect(result).not.toContain('<system-reminder>');
    });

    it('should inject multiple reminders', async () => {
      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Pref 1',
            category: 'technology',
            confidence: 0.9,
            source: 'test',
            toolHints: [
              { toolName: 'testTool', actions: [], reminderTemplate: 'First reminder' },
            ],
          },
          {
            content: 'Pref 2',
            category: 'coding_style',
            confidence: 0.8,
            source: 'test',
            toolHints: [
              { toolName: 'testTool', actions: [], reminderTemplate: 'Second reminder' },
            ],
          },
        ],
        updates: [],
        invalidations: [],
      };
      await storage.updateProfile('test-user', update);

      const tools = {
        testTool: {
          name: 'testTool',
          execute: async () => 'Result',
        },
      };

      const wrapper = createToolReminderWrapper(manager, 'test-user');
      const wrapped = wrapper.wrapTools(tools);

      const result = await wrapped.testTool.execute({});

      expect(result).toContain('<system-reminder>First reminder</system-reminder>');
      expect(result).toContain('<system-reminder>Second reminder</system-reminder>');
    });

    it('should extract action from args.action', async () => {
      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Pref for write',
            category: 'technology',
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
      await storage.updateProfile('test-user', update);

      const tools = {
        fs: {
          name: 'fs',
          execute: async (_args: { action: string }) => 'File result',
        },
      };

      const wrapper = createToolReminderWrapper(manager, 'test-user');
      const wrapped = wrapper.wrapTools(tools);

      const writeResult = await wrapped.fs.execute({ action: 'write' });
      expect(writeResult).toContain('Write reminder');

      const readResult = await wrapped.fs.execute({ action: 'read' });
      expect(readResult).not.toContain('Write reminder');
    });

    it('should extract action from args.command', async () => {
      const update: ProfileUpdate = {
        additions: [
          {
            content: 'Use pnpm',
            category: 'workflow',
            confidence: 0.9,
            source: 'test',
            toolHints: [
              { toolName: 'shell', actions: ['npm'], reminderTemplate: 'Use pnpm instead' },
            ],
          },
        ],
        updates: [],
        invalidations: [],
      };
      await storage.updateProfile('test-user', update);

      const tools = {
        shell: {
          name: 'shell',
          execute: async (_args: { command: string }) => 'Command result',
        },
      };

      const wrapper = createToolReminderWrapper(manager, 'test-user');
      const wrapped = wrapper.wrapTools(tools);

      const npmResult = await wrapped.shell.execute({ command: 'npm install' });
      expect(npmResult).toContain('Use pnpm instead');

      const gitResult = await wrapped.shell.execute({ command: 'git status' });
      expect(gitResult).not.toContain('Use pnpm instead');
    });
  });
});
