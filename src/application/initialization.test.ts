import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeAgent, cleanup } from './initialization.js';

vi.mock('../infrastructure/mcp/client.js', () => ({
  createStdioMCPClient: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue([
      { name: 'test_tool', description: 'Test tool', inputSchema: { type: 'object', properties: {} } }
    ]),
    close: vi.fn(),
  })),
}));

vi.mock('../infrastructure/mcp/adapter.js', () => ({
  mapMcpToolsToAiTools: vi.fn(() => ({
    test_tool: {
      description: 'Test tool',
      parameters: {},
      execute: vi.fn().mockResolvedValue('test result'),
    },
  })),
}));

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

describe('initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APPROVAL_MODE;
  });

  afterEach(() => {
    delete process.env.APPROVAL_MODE;
  });

  describe('initializeAgent', () => {
    it('should initialize all MCP clients', async () => {
      const result = await initializeAgent();

      expect(result.mcpClients).toHaveProperty('filesystem');
      expect(result.mcpClients).toHaveProperty('git');
      expect(result.mcpClients).toHaveProperty('fetch');
      expect(result.mcpClients).toHaveProperty('memory');
      expect(result.mcpClients).toHaveProperty('sequentialThinking');

      expect(result.mcpClients.filesystem.initialize).toHaveBeenCalled();
      expect(result.mcpClients.git.initialize).toHaveBeenCalled();
      expect(result.mcpClients.fetch.initialize).toHaveBeenCalled();
      expect(result.mcpClients.memory.initialize).toHaveBeenCalled();
      expect(result.mcpClients.sequentialThinking.initialize).toHaveBeenCalled();
    });

    it('should create codebase RAG and index', async () => {
      const result = await initializeAgent();

      expect(result.codebaseRAG).toBeDefined();
      expect(result.codebaseRAG.indexCodebase).toHaveBeenCalled();
    });

    it('should create all required tools', async () => {
      const result = await initializeAgent();

      expect(result.tools).toHaveProperty('plan_tool');
      expect(result.tools).toHaveProperty('validation_tool');
      expect(result.tools).toHaveProperty('search_codebase');
      expect(result.tools).toHaveProperty('grep_codebase');
      expect(result.tools).toHaveProperty('task_complete');
      expect(result.tools).toHaveProperty('ask_user');
    });

    it('should initialize usedClients as empty set', async () => {
      const result = await initializeAgent();

      expect(result.usedClients).toBeInstanceOf(Set);
      expect(result.usedClients.size).toBe(0);
    });

    it('should not create readline interface when APPROVAL_MODE is auto', async () => {
      process.env.APPROVAL_MODE = 'auto';
      const result = await initializeAgent();

      expect(result.readline).toBeNull();
    });

    it('should track client usage when wrapped tools are executed', async () => {
      const result = await initializeAgent();

      expect(result.usedClients.size).toBe(0);

      const filesystemTool = result.tools.test_tool;
      if (filesystemTool && typeof filesystemTool.execute === 'function') {
        await filesystemTool.execute({});
      }

      expect(result.usedClients.size).toBeGreaterThan(0);
    });

    it('should create codebase tools with correct descriptions', async () => {
      const result = await initializeAgent();

      expect(result.tools.search_codebase.description).toContain('semantic search');
      expect(result.tools.grep_codebase.description).toContain('regex');
      expect(result.tools.task_complete.description).toContain('completed');
      expect(result.tools.ask_user.description).toContain('question');
    });

    it('should create tools with correct input schemas', async () => {
      const result = await initializeAgent();

      expect(result.tools.search_codebase.inputSchema).toBeDefined();
      expect(result.tools.grep_codebase.inputSchema).toBeDefined();
      expect(result.tools.task_complete.inputSchema).toBeDefined();
      expect(result.tools.ask_user.inputSchema).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should close only used clients', () => {
      const mockClients = {
        filesystem: { close: vi.fn() },
        git: { close: vi.fn() },
        fetch: { close: vi.fn() },
        memory: { close: vi.fn() },
        sequentialThinking: { close: vi.fn() },
      };

      const usedClients = new Set(['filesystem', 'git']);

      cleanup(mockClients, usedClients, null);

      expect(mockClients.filesystem.close).toHaveBeenCalled();
      expect(mockClients.git.close).toHaveBeenCalled();
      expect(mockClients.fetch.close).not.toHaveBeenCalled();
      expect(mockClients.memory.close).not.toHaveBeenCalled();
      expect(mockClients.sequentialThinking.close).not.toHaveBeenCalled();
    });

    it('should close readline interface if provided', () => {
      const mockClients = {
        filesystem: { close: vi.fn() },
        git: { close: vi.fn() },
        fetch: { close: vi.fn() },
        memory: { close: vi.fn() },
        sequentialThinking: { close: vi.fn() },
      };

      const mockReadline = { close: vi.fn() };
      const usedClients = new Set<string>();

      cleanup(mockClients, usedClients, mockReadline as any);

      expect(mockReadline.close).toHaveBeenCalled();
    });

    it('should not throw if readline is null', () => {
      const mockClients = {
        filesystem: { close: vi.fn() },
        git: { close: vi.fn() },
        fetch: { close: vi.fn() },
        memory: { close: vi.fn() },
        sequentialThinking: { close: vi.fn() },
      };

      const usedClients = new Set<string>();

      expect(() => cleanup(mockClients, usedClients, null)).not.toThrow();
    });

    it('should close all clients when all are used', () => {
      const mockClients = {
        filesystem: { close: vi.fn() },
        git: { close: vi.fn() },
        fetch: { close: vi.fn() },
        memory: { close: vi.fn() },
        sequentialThinking: { close: vi.fn() },
      };

      const usedClients = new Set(['filesystem', 'git', 'fetch', 'memory', 'sequentialThinking']);

      cleanup(mockClients, usedClients, null);

      expect(mockClients.filesystem.close).toHaveBeenCalled();
      expect(mockClients.git.close).toHaveBeenCalled();
      expect(mockClients.fetch.close).toHaveBeenCalled();
      expect(mockClients.memory.close).toHaveBeenCalled();
      expect(mockClients.sequentialThinking.close).toHaveBeenCalled();
    });
  });
});
