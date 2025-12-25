import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { initializeAgent, cleanup, CORE_TOOL_NAMES } from './initialization.js';

vi.mock('@agent/memory', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    createCodebaseRAG: (workspaceRoot: string) => ({
      indexCodebase: vi.fn().mockResolvedValue(undefined),
      searchCodebase: vi.fn().mockResolvedValue([]),
      getStats: vi.fn().mockReturnValue({ totalChunks: 0, files: 0 }),
      clearCache: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    }),
  };
});

describe('initializeAgent', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-init-test-'));
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'src', 'test.ts'),
      'export function test() { return "hello"; }'
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('consolidated tools integration', () => {
    it('should create consolidated tools when workspaceRoot is provided', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      expect(result.tools).toBeDefined();
      expect(result.registry).toBeDefined();

      const toolNames = Object.keys(result.tools);

      expect(toolNames).toContain('fs');
      expect(toolNames).toContain('shell');
      expect(toolNames).toContain('web');
      expect(toolNames).toContain('memory');
      expect(toolNames).toContain('delegate');
      expect(toolNames).toContain('task');
      expect(toolNames).toContain('plan');
      expect(toolNames).toContain('sequential_thinking');

      await cleanup(result.readline);
    });

    it('should register tools in the registry', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      const registrySize = result.registry.size();
      expect(registrySize).toBeGreaterThan(0);

      await cleanup(result.readline);
    });

    it('should include core tools', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      const toolNames = Object.keys(result.tools);

      for (const coreTool of CORE_TOOL_NAMES) {
        expect(toolNames).toContain(coreTool);
      }

      await cleanup(result.readline);
    });

    it('should provide tool search, activate, and deactivate tools', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      expect(result.tools.tool_search).toBeDefined();
      expect(result.tools.activate_tool).toBeDefined();
      expect(result.tools.deactivate_tool).toBeDefined();

      await cleanup(result.readline);
    });

    it('should create activation manager', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      expect(result.activationManager).toBeDefined();

      await cleanup(result.readline);
    });
  });

  describe('tool registry', () => {
    it('should create tool registry with correct tool count', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      const totalTools = result.registry.size();
      expect(totalTools).toBeGreaterThan(10);

      await cleanup(result.readline);
    });

    it('should instrument all tools', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      expect(result.tools).toBeDefined();
      expect(typeof result.tools).toBe('object');

      await cleanup(result.readline);
    });
  });

  describe('codebase integration', () => {
    it('should not initialize codebase RAG by default', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
        enableCodebaseIndexing: false,
      });

      expect(result.codebaseRAG).toBeNull();

      await cleanup(result.readline);
    });

    it('should initialize codebase RAG when enabled', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
        enableCodebaseIndexing: true,
      });

      expect(result.codebaseRAG).not.toBeNull();

      await cleanup(result.readline);
    });
  });
});
