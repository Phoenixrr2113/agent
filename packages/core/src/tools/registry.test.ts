import { describe, it, expect, beforeEach } from 'vitest';
import { tool } from 'ai';
import { z } from 'zod';
import {
  ToolRegistry,
  createToolRegistry,
  createToolSearchTool,
  createActivateToolTool,
} from './registry.js';

function createMockTool(description: string) {
  return tool({
    description,
    inputSchema: z.object({ input: z.string() }),
    execute: async ({ input }) => `Executed with ${input}`,
  });
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createToolRegistry();
  });

  describe('register', () => {
    it('should register a tool with metadata', () => {
      const mockTool = createMockTool('Test tool');
      registry.register('test_tool', mockTool, { tags: ['testing'] });

      expect(registry.size()).toBe(1);
      expect(registry.get('test_tool')).toBe(mockTool);
    });

    it('should extract description from tool definition', () => {
      const mockTool = createMockTool('Extracted description');
      registry.register('test_tool', mockTool);

      const metadata = registry.getMetadata('test_tool');
      expect(metadata?.description).toBe('Extracted description');
    });

    it('should use provided description over tool description', () => {
      const mockTool = createMockTool('Tool description');
      registry.register('test_tool', mockTool, { description: 'Override description' });

      const metadata = registry.getMetadata('test_tool');
      expect(metadata?.description).toBe('Tool description');
    });
  });

  describe('registerMany', () => {
    it('should register multiple tools at once', () => {
      const tools = {
        tool1: createMockTool('Tool 1'),
        tool2: createMockTool('Tool 2'),
        tool3: createMockTool('Tool 3'),
      };
      registry.registerMany(tools);

      expect(registry.size()).toBe(3);
      expect(registry.get('tool1')).toBe(tools.tool1);
      expect(registry.get('tool2')).toBe(tools.tool2);
    });

    it('should apply default options to all tools', () => {
      const tools = {
        tool1: createMockTool('Tool 1'),
        tool2: createMockTool('Tool 2'),
      };
      registry.registerMany(tools, { deferLoading: true });

      expect(registry.getMetadata('tool1')?.deferLoading).toBe(true);
      expect(registry.getMetadata('tool2')?.deferLoading).toBe(true);
    });
  });

  describe('getActive and getDeferred', () => {
    it('should separate active and deferred tools', () => {
      registry.register('active1', createMockTool('Active 1'), { deferLoading: false });
      registry.register('active2', createMockTool('Active 2'), { deferLoading: false });
      registry.register('deferred1', createMockTool('Deferred 1'), { deferLoading: true });

      const active = registry.getActive();
      const deferred = registry.getDeferred();

      expect(Object.keys(active)).toEqual(['active1', 'active2']);
      expect(Object.keys(deferred)).toEqual(['deferred1']);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      registry.register('github_create_pr', createMockTool('Create a pull request on GitHub'), {
        tags: ['github', 'git', 'pr'],
      });
      registry.register('github_list_issues', createMockTool('List GitHub issues'), {
        tags: ['github', 'issues'],
      });
      registry.register('slack_send_message', createMockTool('Send a message to Slack'), {
        tags: ['slack', 'messaging'],
      });
      registry.register('file_read', createMockTool('Read file contents'), {
        tags: ['file', 'filesystem'],
      });
    });

    it('should find tools by name', () => {
      const results = registry.search('github');
      expect(results.length).toBe(2);
      expect(results.map(r => r.name)).toContain('github_create_pr');
      expect(results.map(r => r.name)).toContain('github_list_issues');
    });

    it('should find tools by description', () => {
      const results = registry.search('pull request');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('github_create_pr');
    });

    it('should find tools by tag', () => {
      const results = registry.search('messaging');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('slack_send_message');
    });

    it('should respect limit option', () => {
      const results = registry.search('github', { limit: 1 });
      expect(results.length).toBe(1);
    });

    it('should return empty array for no matches', () => {
      const results = registry.search('nonexistent');
      expect(results.length).toBe(0);
    });

    it('should rank exact matches higher', () => {
      registry.register('pr', createMockTool('PR tool'), { tags: ['pr'] });
      const results = registry.search('pr');
      expect(results[0].name).toBe('pr');
    });
  });

  describe('list and clear', () => {
    it('should list all tool metadata', () => {
      registry.register('tool1', createMockTool('Tool 1'));
      registry.register('tool2', createMockTool('Tool 2'));

      const list = registry.list();
      expect(list.length).toBe(2);
      expect(list.map(m => m.name)).toContain('tool1');
    });

    it('should clear all tools', () => {
      registry.register('tool1', createMockTool('Tool 1'));
      registry.register('tool2', createMockTool('Tool 2'));

      registry.clear();
      expect(registry.size()).toBe(0);
    });
  });

  describe('unregister', () => {
    it('should remove a registered tool', () => {
      registry.register('tool1', createMockTool('Tool 1'));
      expect(registry.size()).toBe(1);

      const removed = registry.unregister('tool1');
      expect(removed).toBe(true);
      expect(registry.size()).toBe(0);
    });

    it('should return false for non-existent tool', () => {
      const removed = registry.unregister('nonexistent');
      expect(removed).toBe(false);
    });
  });
});

describe('createToolSearchTool', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createToolRegistry();
    registry.register('github_pr', createMockTool('Create GitHub PR'), { tags: ['github'] });
    registry.register('slack_msg', createMockTool('Send Slack message'), { tags: ['slack'] });
  });

  it('should return search results as JSON', async () => {
    const searchTool = createToolSearchTool(registry);
    const result = await (searchTool as any).execute({ query: 'github', limit: 5 });

    const parsed = JSON.parse(result);
    expect(parsed.found).toBe(true);
    expect(parsed.count).toBe(1);
    expect(parsed.tools[0].name).toBe('github_pr');
  });

  it('should return not found message for no matches', async () => {
    const searchTool = createToolSearchTool(registry);
    const result = await (searchTool as any).execute({ query: 'nonexistent', limit: 5 });

    const parsed = JSON.parse(result);
    expect(parsed.found).toBe(false);
    expect(parsed.message).toContain('No tools found');
  });
});

describe('createActivateToolTool', () => {
  let registry: ToolRegistry;
  let activeTools: Set<string>;

  beforeEach(() => {
    registry = createToolRegistry();
    activeTools = new Set();
    registry.register('deferred_tool', createMockTool('Deferred tool'), { deferLoading: true });
  });

  it('should activate a tool', async () => {
    const activateTool = createActivateToolTool(registry, activeTools);
    const result = await (activateTool as any).execute({ toolName: 'deferred_tool' });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(activeTools.has('deferred_tool')).toBe(true);
  });

  it('should return error for non-existent tool', async () => {
    const activateTool = createActivateToolTool(registry, activeTools);
    const result = await (activateTool as any).execute({ toolName: 'nonexistent' });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('not found');
  });
});

describe('ToolRegistry embedding methods', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = createToolRegistry();
  });

  it('should report hasEmbeddings false when no embeddings generated', () => {
    registry.register('tool1', createMockTool('Tool 1'));
    expect(registry.hasEmbeddings()).toBe(false);
  });

  it('should report hasEmbeddings false for empty registry', () => {
    expect(registry.hasEmbeddings()).toBe(false);
  });
});

