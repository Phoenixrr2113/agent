import { describe, it, expect, vi } from 'vitest';

import { instrumentTool, instrumentTools } from './tool-instrumentation.js';

describe('Tool Instrumentation', () => {
  describe('instrumentTool', () => {
    it('should wrap tool execution with timing', async () => {
      const mockExecute = vi.fn(async (args: { value: number }) => {
        return args.value * 2;
      });

      const instrumented = instrumentTool('test-tool', mockExecute);
      const result = await instrumented({ value: 5 });

      expect(result).toBe(10);
      expect(mockExecute).toHaveBeenCalledWith({ value: 5 });
    });

    it('should inject timing into JSON string results', async () => {
      const mockExecute = vi.fn(async () => {
        return JSON.stringify({ success: true, data: 'test' });
      });

      const instrumented = instrumentTool('test-tool', mockExecute);
      const result = await instrumented({});

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data).toBe('test');
      expect(parsed._timing).toBeDefined();
      expect(parsed._timing.durationMs).toBeDefined();
    });

    it('should handle non-JSON string results', async () => {
      const mockExecute = vi.fn(async () => {
        return 'plain text result';
      });

      const instrumented = instrumentTool('test-tool', mockExecute);
      const result = await instrumented({});

      expect(result).toBe('plain text result');
    });

    it('should handle errors and rethrow', async () => {
      const mockExecute = vi.fn(async () => {
        throw new Error('Tool execution failed');
      });

      const instrumented = instrumentTool('test-tool', mockExecute);

      await expect(instrumented({})).rejects.toThrow('Tool execution failed');
    });

    it('should work with sync functions', async () => {
      const mockExecute = vi.fn((args: { value: string }) => {
        return args.value.toUpperCase();
      });

      const instrumented = instrumentTool('test-tool', mockExecute);
      const result = await instrumented({ value: 'hello' });

      expect(result).toBe('HELLO');
    });
  });

  describe('instrumentTools', () => {
    it('should instrument all tools in a collection', () => {
      const tools = {
        tool1: {
          description: 'Tool 1',
          execute: async () => 'result1',
        },
        tool2: {
          description: 'Tool 2',
          execute: async () => 'result2',
        },
      };

      const instrumented = instrumentTools(tools);

      expect(instrumented.tool1).toBeDefined();
      expect(instrumented.tool2).toBeDefined();
      expect(typeof instrumented.tool1.execute).toBe('function');
      expect(typeof instrumented.tool2.execute).toBe('function');
    });

    it('should preserve tool properties', () => {
      const tools = {
        myTool: {
          description: 'My test tool',
          inputSchema: { type: 'object' },
          execute: async () => 'result',
        },
      };

      const instrumented = instrumentTools(tools);

      expect(instrumented.myTool.description).toBe('My test tool');
      expect(instrumented.myTool.inputSchema).toEqual({ type: 'object' });
    });

    it('should skip non-tool objects', () => {
      const tools = {
        tool1: {
          execute: async () => 'result',
        },
        notATool: 'just a string',
        alsoNotATool: 123,
      };

      const instrumented = instrumentTools(tools);

      expect(instrumented.tool1).toBeDefined();
      expect(instrumented.notATool).toBe('just a string');
      expect(instrumented.alsoNotATool).toBe(123);
    });

    it('should handle empty tool collections', () => {
      const tools = {};
      const instrumented = instrumentTools(tools);
      expect(Object.keys(instrumented)).toHaveLength(0);
    });
  });
});
