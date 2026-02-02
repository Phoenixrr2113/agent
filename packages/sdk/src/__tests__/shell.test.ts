/**
 * @fileoverview Tests for shell tool.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as os from 'node:os';
import {
  createShellTool,
  DEFAULT_TIMEOUT,
  MAX_TIMEOUT,
} from '../tools/shell';

describe('Shell Tool', () => {
  let tool: ReturnType<typeof createShellTool>;

  beforeEach(() => {
    tool = createShellTool({ workspaceRoot: os.tmpdir() });
  });

  describe('Constants', () => {
    it('should have correct default timeout', () => {
      expect(DEFAULT_TIMEOUT).toBe(30000);
    });

    it('should have correct max timeout', () => {
      expect(MAX_TIMEOUT).toBe(300000);
    });
  });

  describe('Command Execution', () => {
    it('should execute simple commands', async () => {
      const result = await tool.execute(
        { command: 'echo "hello"' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.exitCode).toBe(0);
      expect(parsed.status).toBe('success');
    });

    it('should return exit code for failed commands', async () => {
      const result = await tool.execute(
        { command: 'exit 1' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true); // Tool succeeded in running
      expect(parsed.exitCode).toBe(1);
      expect(parsed.status).toBe('failed');
    });

    it('should respect custom cwd', async () => {
      const result = await tool.execute(
        { command: 'pwd', cwd: '/tmp' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Dangerous Commands', () => {
    it('should block rm -rf /', async () => {
      await expect(
        tool.execute(
          { command: 'rm -rf /' },
          { toolCallId: 'test', messages: [] }
        )
      ).rejects.toThrow('Command blocked');
    });

    it('should block sudo commands', async () => {
      await expect(
        tool.execute(
          { command: 'sudo rm file.txt' },
          { toolCallId: 'test', messages: [] }
        )
      ).rejects.toThrow('Command blocked');
    });

    it('should block shutdown commands', async () => {
      await expect(
        tool.execute(
          { command: 'shutdown now' },
          { toolCallId: 'test', messages: [] }
        )
      ).rejects.toThrow('Command blocked');
    });
  });

  describe('Interactive Commands', () => {
    it('should reject vim', async () => {
      const result = await tool.execute(
        { command: 'vim file.txt' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Interactive');
    });

    it('should reject nano', async () => {
      const result = await tool.execute(
        { command: 'nano file.txt' },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Timeout', () => {
    it('should timeout long-running commands', async () => {
      const result = await tool.execute(
        { command: 'sleep 10', timeout: 500 },
        { toolCallId: 'test', messages: [] }
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('timed out');
    }, 10000);
  });
});
