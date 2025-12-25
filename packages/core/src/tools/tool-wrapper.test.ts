import { tool } from 'ai';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';

import { type ToolActivationManager, createToolActivationManager } from './middleware/index.js';

function createMockTool(description: string) {
  return tool({
    description,
    inputSchema: z.object({ input: z.string() }),
    execute: async ({ input }) => `Executed with ${input}`,
  });
}

describe('ToolActivationManager', () => {
  let manager: ToolActivationManager;

  beforeEach(() => {
    manager = createToolActivationManager();
  });

  describe('activation', () => {
    it('should activate a tool', () => {
      const activated = manager.activate('test_tool');
      expect(activated).toBe(true);
      expect(manager.isActive('test_tool')).toBe(true);
    });

    it('should return false when activating already active tool', () => {
      manager.activate('test_tool');
      const activated = manager.activate('test_tool');
      expect(activated).toBe(false);
    });

    it('should track multiple active tools', () => {
      manager.activate('tool1');
      manager.activate('tool2');
      manager.activate('tool3');

      expect(manager.size()).toBe(3);
      expect(manager.isActive('tool1')).toBe(true);
      expect(manager.isActive('tool2')).toBe(true);
      expect(manager.isActive('tool3')).toBe(true);
    });
  });

  describe('deactivation', () => {
    it('should deactivate an active tool', () => {
      manager.activate('test_tool');
      const deactivated = manager.deactivate('test_tool');
      expect(deactivated).toBe(true);
      expect(manager.isActive('test_tool')).toBe(false);
    });

    it('should return false when deactivating non-active tool', () => {
      const deactivated = manager.deactivate('nonexistent');
      expect(deactivated).toBe(false);
    });
  });

  describe('getActiveToolNames', () => {
    it('should return empty array when no tools active', () => {
      expect(manager.getActiveToolNames()).toEqual([]);
    });

    it('should return all active tool names', () => {
      manager.activate('tool1');
      manager.activate('tool2');
      const names = manager.getActiveToolNames();
      expect(names).toHaveLength(2);
      expect(names).toContain('tool1');
      expect(names).toContain('tool2');
    });
  });

  describe('createDeferredWrapper', () => {
    it('should create a wrapped tool that blocks when not activated', async () => {
      const originalTool = createMockTool('Test tool');
      const wrapped = manager.createDeferredWrapper('test_tool', originalTool, 'Test tool description');

      const result = await (wrapped as any).execute({ input: 'test' });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe('TOOL_NOT_ACTIVATED');
      expect(parsed.toolName).toBe('test_tool');
      expect(parsed.message).toContain('requires activation');
    });

    it('should allow execution when tool is activated', async () => {
      const originalTool = createMockTool('Test tool');
      const wrapped = manager.createDeferredWrapper('test_tool', originalTool, 'Test tool description');

      manager.activate('test_tool');
      const result = await (wrapped as any).execute({ input: 'test' });

      expect(result).toBe('Executed with test');
    });

    it('should include activation instruction in error', async () => {
      const originalTool = createMockTool('Test tool');
      const wrapped = manager.createDeferredWrapper('my_special_tool', originalTool, 'Special tool');

      const result = await (wrapped as any).execute({ input: 'test' });
      const parsed = JSON.parse(result);

      expect(parsed.instruction).toContain('activate_tool');
      expect(parsed.instruction).toContain('my_special_tool');
    });

    it('should preserve original tool description in wrapper', () => {
      const originalTool = createMockTool('Original description');
      const wrapped = manager.createDeferredWrapper('test_tool', originalTool, 'Custom description');

      const description = (wrapped as any).description;
      expect(description).toContain('Custom description');
      expect(description).toContain('requires activation');
    });
  });

  describe('clear', () => {
    it('should clear all active tools', () => {
      manager.activate('tool1');
      manager.activate('tool2');
      manager.clear();

      expect(manager.size()).toBe(0);
      expect(manager.getActiveToolNames()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return correct count', () => {
      expect(manager.size()).toBe(0);
      manager.activate('tool1');
      expect(manager.size()).toBe(1);
      manager.activate('tool2');
      expect(manager.size()).toBe(2);
      manager.deactivate('tool1');
      expect(manager.size()).toBe(1);
    });
  });

  describe('integration scenario', () => {
    it('should handle complete activation workflow', async () => {
      const tool1 = createMockTool('Web search tool');
      const tool2 = createMockTool('Database tool');

      const wrappedTool1 = manager.createDeferredWrapper('web_search', tool1, 'Search the web');
      const wrappedTool2 = manager.createDeferredWrapper('database', tool2, 'Query database');

      let result = await (wrappedTool1 as any).execute({ input: 'test' });
      expect(JSON.parse(result).error).toBe('TOOL_NOT_ACTIVATED');

      manager.activate('web_search');

      result = await (wrappedTool1 as any).execute({ input: 'test' });
      expect(result).toBe('Executed with test');

      result = await (wrappedTool2 as any).execute({ input: 'test' });
      expect(JSON.parse(result).error).toBe('TOOL_NOT_ACTIVATED');

      manager.activate('database');

      result = await (wrappedTool2 as any).execute({ input: 'test' });
      expect(result).toBe('Executed with test');
    });
  });
});
