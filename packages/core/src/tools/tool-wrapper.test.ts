import { describe, it, expect, beforeEach } from 'vitest';
import { tool } from 'ai';
import { z } from 'zod';
import { ToolActivationManager, createToolActivationManager } from './tool-wrapper.js';

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

  describe('initialActiveTools', () => {
    it('should initialize with pre-activated tools', () => {
      const managerWithInitial = createToolActivationManager({
        initialActiveTools: ['tool1', 'tool2'],
      });

      expect(managerWithInitial.isActive('tool1')).toBe(true);
      expect(managerWithInitial.isActive('tool2')).toBe(true);
      expect(managerWithInitial.isActive('tool3')).toBe(false);
      expect(managerWithInitial.size()).toBe(2);
    });

    it('should allow deferred tool execution when pre-activated', async () => {
      const managerWithInitial = createToolActivationManager({
        initialActiveTools: ['web_search'],
      });

      const webSearchTool = createMockTool('Web search');
      const wrapped = managerWithInitial.createDeferredWrapper('web_search', webSearchTool, 'Search the web');

      const result = await (wrapped as any).execute({ input: 'query' });
      expect(result).toBe('Executed with query');
    });
  });

  describe('callbacks', () => {
    it('should call onActivate callback when tool is activated', async () => {
      const activatedTools: string[] = [];
      const managerWithCallback = createToolActivationManager({
        callbacks: {
          onActivate: (toolName, allActiveTools) => {
            activatedTools.push(toolName);
          },
        },
      });

      managerWithCallback.activate('tool1');
      managerWithCallback.activate('tool2');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(activatedTools).toContain('tool1');
      expect(activatedTools).toContain('tool2');
    });

    it('should call onDeactivate callback when tool is deactivated', async () => {
      const deactivatedTools: string[] = [];
      const managerWithCallback = createToolActivationManager({
        callbacks: {
          onDeactivate: (toolName, allActiveTools) => {
            deactivatedTools.push(toolName);
          },
        },
      });

      managerWithCallback.activate('tool1');
      managerWithCallback.activate('tool2');
      managerWithCallback.deactivate('tool1');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(deactivatedTools).toEqual(['tool1']);
    });

    it('should not call onDeactivate for non-active tools', async () => {
      const deactivatedTools: string[] = [];
      const managerWithCallback = createToolActivationManager({
        callbacks: {
          onDeactivate: (toolName) => {
            deactivatedTools.push(toolName);
          },
        },
      });

      managerWithCallback.deactivate('nonexistent');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(deactivatedTools).toEqual([]);
    });

    it('should pass all active tools to callbacks', async () => {
      let capturedActiveTools: string[] = [];
      const managerWithCallback = createToolActivationManager({
        callbacks: {
          onActivate: (_toolName, allActiveTools) => {
            capturedActiveTools = [...allActiveTools];
          },
        },
      });

      managerWithCallback.activate('tool1');
      managerWithCallback.activate('tool2');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(capturedActiveTools).toContain('tool1');
      expect(capturedActiveTools).toContain('tool2');
    });
  });
});
