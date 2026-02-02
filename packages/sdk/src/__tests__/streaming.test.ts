/**
 * @agent/sdk - Transient Streaming Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  withTransientStreaming,
  writeTransient,
  streamTransient,
  streamFileContent,
  streamShellOutput,
  streamSearchResult,
  streamProgress,
  type TransientStreamWriter,
} from '../streaming/transient';
import type { ToolContext } from '../types/lifecycle';

// Mock stream writer
function createMockWriter(): TransientStreamWriter & { data: unknown[] } {
  const data: unknown[] = [];
  return {
    data,
    writeData(d: unknown) {
      data.push(d);
    },
  };
}

// Mock tool context
function createMockContext(writer?: TransientStreamWriter): ToolContext {
  return {
    agentId: 'test-agent',
    stepNumber: 1,
    writer: writer as any,
  };
}

describe('writeTransient', () => {
  it('writes typed data with transient flag', () => {
    const writer = createMockWriter();
    
    writeTransient(writer, 'file-content', {
      path: '/test/file.ts',
      content: 'console.log("test")',
      truncated: false,
    });

    expect(writer.data).toHaveLength(1);
    expect(writer.data[0]).toMatchObject({
      type: 'file-content',
      data: {
        path: '/test/file.ts',
        content: 'console.log("test")',
        truncated: false,
      },
      transient: true,
    });
  });

  it('writes shell output data', () => {
    const writer = createMockWriter();
    
    writeTransient(writer, 'shell-output', {
      command: 'npm test',
      output: 'All tests passed',
      exitCode: 0,
    });

    expect(writer.data[0]).toMatchObject({
      type: 'shell-output',
      transient: true,
    });
  });
});

describe('streamTransient', () => {
  it('streams data via context writer', () => {
    const writer = createMockWriter();
    const ctx = createMockContext(writer);

    streamTransient(ctx, 'search-result', {
      path: 'src/index.ts',
      content: 'export function test()',
      matches: 3,
    });

    expect(writer.data).toHaveLength(1);
    expect(writer.data[0]).toMatchObject({
      type: 'search-result',
      transient: true,
    });
  });

  it('does not throw if no writer in context', () => {
    const ctx = createMockContext(); // No writer

    // Should not throw
    expect(() => {
      streamTransient(ctx, 'file-content', {
        path: '/test.ts',
        content: 'test',
        truncated: false,
      });
    }).not.toThrow();
  });
});

describe('streamFileContent', () => {
  it('streams file content with options', () => {
    const writer = createMockWriter();
    const ctx = createMockContext(writer);

    streamFileContent(ctx, '/path/to/file.ts', 'const x = 1;', {
      truncated: true,
      totalBytes: 1000,
      language: 'typescript',
    });

    expect(writer.data[0]).toMatchObject({
      type: 'file-content',
      data: {
        path: '/path/to/file.ts',
        content: 'const x = 1;',
        truncated: true,
        totalBytes: 1000,
        language: 'typescript',
      },
    });
  });
});

describe('streamShellOutput', () => {
  it('streams shell output with metadata', () => {
    const writer = createMockWriter();
    const ctx = createMockContext(writer);

    streamShellOutput(ctx, 'ls -la', 'file1\nfile2', 0, {
      cwd: '/home/user',
      durationMs: 50,
    });

    expect(writer.data[0]).toMatchObject({
      type: 'shell-output',
      data: {
        command: 'ls -la',
        output: 'file1\nfile2',
        exitCode: 0,
        cwd: '/home/user',
        durationMs: 50,
      },
    });
  });
});

describe('streamSearchResult', () => {
  it('streams search results', () => {
    const writer = createMockWriter();
    const ctx = createMockContext(writer);

    streamSearchResult(ctx, 'src/app.ts', 'function main()', 5, {
      line: 42,
      pattern: 'main',
    });

    expect(writer.data[0]).toMatchObject({
      type: 'search-result',
      data: {
        path: 'src/app.ts',
        content: 'function main()',
        matches: 5,
        line: 42,
        pattern: 'main',
      },
    });
  });
});

describe('streamProgress', () => {
  it('streams progress updates', () => {
    const writer = createMockWriter();
    const ctx = createMockContext(writer);

    streamProgress(ctx, 'file-indexer', 75, 'Indexing files...', {
      step: { current: 3, total: 4 },
    });

    expect(writer.data[0]).toMatchObject({
      type: 'tool-progress',
      data: {
        toolName: 'file-indexer',
        progress: 75,
        message: 'Indexing files...',
        step: { current: 3, total: 4 },
      },
    });
  });
});

describe('withTransientStreaming', () => {
  it('wraps tools with streaming context', async () => {
    const writer = createMockWriter();
    
    const mockTool = {
      description: 'Test tool',
      parameters: {},
      execute: vi.fn().mockResolvedValue('result'),
    };

    const wrapped = withTransientStreaming({ test: mockTool }, writer);
    
    // Execute wrapped tool
    await (wrapped.test as any).execute({ input: 'test' }, {});

    // Verify execute was called
    expect(mockTool.execute).toHaveBeenCalled();
  });

  it('passes through tools without execute', () => {
    const writer = createMockWriter();
    
    const toolWithoutExecute = {
      description: 'Schema only',
      parameters: {},
    };

    const wrapped = withTransientStreaming({ schema: toolWithoutExecute }, writer);
    
    expect(wrapped.schema).toBe(toolWithoutExecute);
  });
});
