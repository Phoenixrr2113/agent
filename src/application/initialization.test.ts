import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeAgent, cleanup } from './initialization.js';

vi.mock('../core/rag/index.js', () => ({
  createCodebaseRAG: vi.fn(() => ({
    indexCodebase: vi.fn().mockResolvedValue(undefined),
    searchCodebase: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockReturnValue({ totalChunks: 10, files: 2 }),
  })),
}));

vi.mock('../core/search/grep.js', () => ({
  grepWorkspace: vi.fn().mockResolvedValue([]),
}));

vi.mock('../tools/workflow.js', () => ({
  planTool: {
    description: 'Plan tool',
    parameters: {},
    execute: vi.fn(),
  },
  validationTool: {
    description: 'Validation tool',
    parameters: {},
    execute: vi.fn(),
  },
}));

vi.mock('../tools/shell.js', () => ({
  shellTool: {
    description: 'Shell tool',
    parameters: {},
    execute: vi.fn(),
  },
}));

vi.mock('../tools/web-search.js', () => ({
  webSearchTool: {
    description: 'Web search tool',
    parameters: {},
    execute: vi.fn(),
  },
}));

vi.mock('../tools/fetch-page.js', () => ({
  fetchPageTool: {
    description: 'Fetch page tool',
    parameters: {},
    execute: vi.fn(),
  },
}));

vi.mock('../tools/memory.js', () => ({
  memoryTools: {
    memory_add: {
      description: 'Memory add tool',
      parameters: {},
      execute: vi.fn(),
    },
    memory_search: {
      description: 'Memory search tool',
      parameters: {},
      execute: vi.fn(),
    },
  },
}));

vi.mock('../tools/codebase.js', () => ({
  createCodebaseTools: vi.fn(() => ({
    search_codebase: {
      description: 'Search codebase using semantic search',
      parameters: {},
      execute: vi.fn(),
    },
    grep_codebase: {
      description: 'Search for regex patterns',
      parameters: {},
      execute: vi.fn(),
    },
  })),
}));

vi.mock('../tools/agent.js', () => ({
  createAgentTools: vi.fn(() => ({
    task_complete: {
      description: 'Mark task as completed',
      parameters: {},
      execute: vi.fn(),
    },
    ask_user: {
      description: 'Ask the user a question',
      parameters: {},
      execute: vi.fn(),
    },
  })),
}));

describe('initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APPROVAL_MODE;
  });

  afterEach(() => {
    delete process.env.APPROVAL_MODE;
  });

  describe('initializeAgent', () => {
    it('should create codebase RAG and index', async () => {
      const result = await initializeAgent();

      expect(result.codebaseRAG).toBeDefined();
      expect(result.codebaseRAG.indexCodebase).toHaveBeenCalled();
    });

    it('should create all required native tools', async () => {
      const result = await initializeAgent();

      expect(result.tools).toHaveProperty('shell');
      expect(result.tools).toHaveProperty('web_search');
      expect(result.tools).toHaveProperty('fetch_page');
      expect(result.tools).toHaveProperty('memory_add');
      expect(result.tools).toHaveProperty('memory_search');
      expect(result.tools).toHaveProperty('plan');
      expect(result.tools).toHaveProperty('validate');
      expect(result.tools).toHaveProperty('search_codebase');
      expect(result.tools).toHaveProperty('grep_codebase');
      expect(result.tools).toHaveProperty('task_complete');
      expect(result.tools).toHaveProperty('ask_user');
    });

    it('should not create readline interface when APPROVAL_MODE is auto', async () => {
      process.env.APPROVAL_MODE = 'auto';
      const result = await initializeAgent();

      expect(result.readline).toBeNull();
    });

    it('should create tools with correct descriptions', async () => {
      const result = await initializeAgent();

      expect(result.tools.search_codebase.description).toContain('semantic');
      expect(result.tools.grep_codebase.description).toContain('regex');
      expect(result.tools.task_complete.description).toContain('completed');
      expect(result.tools.ask_user.description).toContain('question');
    });
  });

  describe('cleanup', () => {
    it('should close only used clients', async () => {
      const mockClients = {
        filesystem: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        git: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        fetch: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        memory: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        sequentialThinking: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
      };

      const usedClients = new Set(['filesystem', 'git']);

      await cleanup(mockClients, usedClients, null);

      expect(mockClients.filesystem.close).toHaveBeenCalled();
      expect(mockClients.git.close).toHaveBeenCalled();
      expect(mockClients.fetch.close).not.toHaveBeenCalled();
      expect(mockClients.memory.close).not.toHaveBeenCalled();
      expect(mockClients.sequentialThinking.close).not.toHaveBeenCalled();
    });

    it('should close readline interface if provided', async () => {
      const mockClients = {
        filesystem: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        git: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        fetch: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        memory: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        sequentialThinking: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
      };

      const mockReadline = { close: vi.fn() };
      const usedClients = new Set<string>();

      await cleanup(mockClients, usedClients, mockReadline as any);

      expect(mockReadline.close).toHaveBeenCalled();
    });

    it('should not throw if readline is null', async () => {
      const mockClients = {
        filesystem: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        git: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        fetch: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        memory: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        sequentialThinking: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
      };

      const usedClients = new Set<string>();

      await expect(cleanup(mockClients, usedClients, null)).resolves.not.toThrow();
    });

    it('should close all clients when all are used', async () => {
      const mockClients = {
        filesystem: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        git: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        fetch: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        memory: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
        sequentialThinking: { close: vi.fn().mockResolvedValue(undefined), tools: vi.fn() },
      };

      const usedClients = new Set(['filesystem', 'git', 'fetch', 'memory', 'sequentialThinking']);

      await cleanup(mockClients, usedClients, null);

      expect(mockClients.filesystem.close).toHaveBeenCalled();
      expect(mockClients.git.close).toHaveBeenCalled();
      expect(mockClients.fetch.close).toHaveBeenCalled();
      expect(mockClients.memory.close).toHaveBeenCalled();
      expect(mockClients.sequentialThinking.close).toHaveBeenCalled();
    });
  });
});
