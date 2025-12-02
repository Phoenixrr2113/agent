import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { initializeAgent, cleanup } from './initialization.js';

vi.mock('../core/rag/index.js', () => ({
  createCodebaseRAG: (workspaceRoot: string) => ({
    indexCodebase: vi.fn().mockResolvedValue(undefined),
    searchCodebase: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockReturnValue({ totalChunks: 0, files: 0 }),
    clearCache: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
  }),
}));

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

  describe('filesystem tools integration', () => {
    it('should create filesystem tools when workspaceRoot is provided', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      expect(result.tools).toBeDefined();
      expect(result.registry).toBeDefined();

      const metadata = result.registry.list();
      const toolNames = metadata.map(m => m.name);

      expect(toolNames).toContain('read_text_file');
      expect(toolNames).toContain('read_media_file');
      expect(toolNames).toContain('read_multiple_files');
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('edit_file');
      expect(toolNames).toContain('create_directory');
      expect(toolNames).toContain('list_directory');
      expect(toolNames).toContain('list_directory_with_sizes');
      expect(toolNames).toContain('directory_tree');
      expect(toolNames).toContain('search_files');
      expect(toolNames).toContain('get_file_info');
      expect(toolNames).toContain('move_file');

      await cleanup(result.readline);
    });

    it('should register filesystem tools as deferred', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      const filesystemToolNames = [
        'read_text_file',
        'write_file',
        'edit_file',
        'create_directory',
        'list_directory',
        'search_files',
        'get_file_info',
        'move_file',
      ];

      for (const toolName of filesystemToolNames) {
        const metadata = result.registry.getMetadata(toolName);
        expect(metadata?.deferLoading).toBe(true);
      }

      await cleanup(result.readline);
    });

    it('should not create filesystem tools when workspaceRoot is not provided', async () => {
      const result = await initializeAgent({
        enableReadline: false,
        enableSemanticSearch: false,
      });

      const metadata = result.registry.list();
      const toolNames = metadata.map(m => m.name);

      expect(toolNames).not.toContain('read_text_file');
      expect(toolNames).not.toContain('write_file');
      expect(toolNames).not.toContain('edit_file');

      await cleanup(result.readline);
    });

    it('should include active tools and deferred tools', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      const activeTools = result.registry.getActive();
      const deferredTools = result.registry.getDeferred();

      expect(Object.keys(activeTools)).toContain('shell');
      expect(Object.keys(activeTools)).toContain('plan');
      expect(Object.keys(activeTools)).toContain('sequential_thinking');

      expect(Object.keys(deferredTools)).toContain('read_text_file');
      expect(Object.keys(deferredTools)).toContain('write_file');
      expect(Object.keys(deferredTools)).toContain('web_search');

      await cleanup(result.readline);
    });

    it('should provide tool search, activate, and deactivate tools', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      expect(result.tools.search_tools).toBeDefined();
      expect(result.tools.activate_tool).toBeDefined();
      expect(result.tools.deactivate_tool).toBeDefined();

      await cleanup(result.readline);
    });

    it('should wrap deferred tools with activation manager', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      expect(result.activationManager).toBeDefined();

      const deferredToolNames = [
        'read_text_file',
        'write_file',
        'web_search',
      ];

      for (const toolName of deferredToolNames) {
        expect(result.tools[toolName]).toBeDefined();
      }

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
      expect(totalTools).toBeGreaterThan(15);

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
    it('should initialize codebase RAG when workspaceRoot is provided', async () => {
      const result = await initializeAgent({
        workspaceRoot: tempDir,
        enableReadline: false,
        enableSemanticSearch: false,
      });

      expect(result.codebaseRAG).not.toBeNull();

      await cleanup(result.readline);
    });

    it('should not initialize codebase RAG when workspaceRoot is not provided', async () => {
      const result = await initializeAgent({
        enableReadline: false,
        enableSemanticSearch: false,
      });

      expect(result.codebaseRAG).toBeNull();

      await cleanup(result.readline);
    });
  });
});
