import { describe, it, expect, vi } from 'vitest';
import { withLifecycle, ToolError, ToolErrorType, wrapWithTiming } from './middleware/index.js';
import { success, error } from './utils/tool-result.js';
import { tool } from 'ai';
import { z } from 'zod';

describe('withLifecycle', () => {
  it('wraps existing tool with hooks', async () => {
    const baseTool = tool({
      description: 'Base tool',
      inputSchema: z.object({ x: z.number() }),
      execute: async ({ x }) => ({ doubled: x * 2 }),
    });

    const enhanced = withLifecycle(baseTool, {
      beforeExecute: async (input) => ({ ...input, x: input.x + 1 }),
      afterExecute: async (input, output) => ({ ...output, tripled: input.x * 3 }),
    });

    const result = await (enhanced as any).execute({ x: 5 });

    expect(result.doubled).toBe(12);
    expect(result.tripled).toBe(18);
  });

  it('stops on validation failure', async () => {
    const baseTool = tool({
      description: 'Base tool',
      inputSchema: z.object({ value: z.number() }),
      execute: async ({ value }) => ({ result: value }),
    });

    const enhanced = withLifecycle(baseTool, {
      validate: async () => ({
        valid: false,
        error: 'Validation failed',
        errorType: ToolErrorType.INVALID_INPUT,
      }),
    });

    await expect((enhanced as any).execute({ value: 5 })).rejects.toThrow(ToolError);
  });

  it('calls cleanup on success', async () => {
    let cleanupCalled = false;
    let cleanupSuccess: boolean | undefined;

    const baseTool = tool({
      description: 'Base tool',
      inputSchema: z.object({ value: z.number() }),
      execute: async () => ({ result: 'success' }),
    });

    const enhanced = withLifecycle(baseTool, {
      cleanup: async (input, success) => {
        cleanupCalled = true;
        cleanupSuccess = success;
      },
    });

    await (enhanced as any).execute({ value: 5 });
    expect(cleanupCalled).toBe(true);
    expect(cleanupSuccess).toBe(true);
  });

  it('calls cleanup on failure', async () => {
    let cleanupCalled = false;
    let cleanupSuccess: boolean | undefined;

    const baseTool = tool({
      description: 'Base tool',
      inputSchema: z.object({ value: z.number() }),
      execute: async () => {
        throw new Error('Test error');
      },
    });

    const enhanced = withLifecycle(baseTool, {
      cleanup: async (input, success) => {
        cleanupCalled = true;
        cleanupSuccess = success;
      },
    });

    await expect((enhanced as any).execute({ value: 5 })).rejects.toThrow();
    expect(cleanupCalled).toBe(true);
    expect(cleanupSuccess).toBe(false);
  });

  it('can recover from error with onError', async () => {
    const baseTool = tool({
      description: 'Base tool',
      inputSchema: z.object({ value: z.number() }),
      execute: async () => {
        throw new Error('Test error');
      },
    });

    const enhanced = withLifecycle(baseTool, {
      onError: async () => ({ recovered: true }),
    });

    const result = await (enhanced as any).execute({ value: 5 });
    expect(result.recovered).toBe(true);
  });
});

describe('wrapWithTiming', () => {
  it('wraps function with timing logs', async () => {
    const fn = vi.fn(async (x: number) => x * 2);
    const wrapped = wrapWithTiming('test', fn);
    
    const result = await wrapped(5);
    
    expect(result).toBe(10);
    expect(fn).toHaveBeenCalledWith(5);
  });
});

describe('ToolError', () => {
  it('serializes to JSON correctly', () => {
    const err = new ToolError('File not found', ToolErrorType.FILE_NOT_FOUND, { path: '/test' });
    const json = err.toJSON();

    expect(json.success).toBe(false);
    expect(json.error).toBe('File not found');
    expect(json.errorType).toBe('FILE_NOT_FOUND');
    expect(json.path).toBe('/test');
  });
});

describe('success helper', () => {
  it('creates success JSON response', () => {
    const result = JSON.parse(success({ data: 'test' }));
    expect(result.success).toBe(true);
    expect(result.data).toBe('test');
  });
});

describe('error helper', () => {
  it('creates error JSON response', () => {
    const result = JSON.parse(error('Something failed', { code: 123 }));
    expect(result.success).toBe(false);
    expect(result.error).toBe('Something failed');
    expect(result.code).toBe(123);
  });

  it('handles Error objects', () => {
    const result = JSON.parse(error(new Error('Error message')));
    expect(result.success).toBe(false);
    expect(result.error).toBe('Error message');
  });
});
