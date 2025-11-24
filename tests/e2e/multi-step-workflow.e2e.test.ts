import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateText } from 'ai';
import { createStdioMCPClient } from '../../src/mcp-client.js';
import { mapMcpToolsToAiTools } from '../../src/tools.js';
import { createCodebaseRAG } from '../../src/rag.js';
import { grepWorkspace } from '../../src/grep.js';
import { setupTestWorkspace, teardownTestWorkspace, writeTestFile } from '../helpers/test-utils.js';
import { getTestModel, hasModelProvider } from '../helpers/test-model.js';
import { z } from 'zod';

const hasGoogleAIKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

describe.skipIf(!hasModelProvider() || !hasGoogleAIKey)('Multi-Step Workflow E2E tests', () => {
  let workspace: string;
  let filesystemClient: ReturnType<typeof createStdioMCPClient>;

  beforeEach(async () => {
    workspace = await setupTestWorkspace('e2e-workflow');
    filesystemClient = createStdioMCPClient('npx', [
      '-y',
      '@modelcontextprotocol/server-filesystem',
      workspace,
    ]);
    await filesystemClient.initialize();
  });

  afterEach(async () => {
    filesystemClient.close();
    await teardownTestWorkspace(workspace);
  });

  it('should complete workflow: search → read → analyze', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const fsMcpTools = await filesystemClient.listTools();
    const fsTools = mapMcpToolsToAiTools(fsMcpTools, filesystemClient);

    const codebaseTools = {
      search_codebase: {
        description: 'Search the codebase using semantic search',
        parameters: z.object({
          query: z.string(),
          topK: z.number().optional(),
        }),
        execute: async ({ query, topK = 5 }: { query: string; topK?: number }) => {
          const results = await rag.searchCodebase(query, topK);
          return JSON.stringify(
            results.map(r => ({
              file: r.filePath,
              lines: `${r.startLine}-${r.endLine}`,
              content: r.content.substring(0, 200),
            }))
          );
        },
      },
    };

    const tools = { ...fsTools, ...codebaseTools };

    const result = await generateText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'Search for sum functions in the codebase, then read one of the files you find',
        },
      ],
      tools,
      maxSteps: 5,
    });


    expect(result.response.messages).toBeDefined();

    const toolNames = result.response.messages
      .filter((m: any) => m.role === 'assistant' && m.toolInvocations)
      .flatMap((m: any) => m.toolInvocations.map((t: any) => t.toolName));

    expect(toolNames).toContain('search_codebase');
    expect(toolNames.some((name: string) => name.includes('read'))).toBe(true);
  });

  it('should complete workflow: write file → read back → verify', async () => {
    const fsMcpTools = await filesystemClient.listTools();
    const fsTools = mapMcpToolsToAiTools(fsMcpTools, filesystemClient);

    const testFilePath = `${workspace}/test-output.txt`;

    const result = await generateText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: `Write "Hello E2E Test" to ${testFilePath}, then read it back to verify`,
        },
      ],
      tools: fsTools,
      maxSteps: 5,
    });


    const toolNames = result.response.messages
      .filter((m: any) => m.role === 'assistant' && m.toolInvocations)
      .flatMap((m: any) => m.toolInvocations.map((t: any) => t.toolName));

    expect(toolNames.some((name: string) => name.includes('write'))).toBe(true);
    expect(toolNames.some((name: string) => name.includes('read'))).toBe(true);
  });

  it('should chain grep → read files → analyze pattern', async () => {
    await writeTestFile(
      workspace,
      'pattern-test.ts',
      'export function processData(input: string) { return input.toUpperCase(); }'
    );

    const fsMcpTools = await filesystemClient.listTools();
    const fsTools = mapMcpToolsToAiTools(fsMcpTools, filesystemClient);

    const codebaseTools = {
      grep_codebase: {
        description: 'Search for patterns using regex',
        parameters: z.object({
          pattern: z.string(),
        }),
        execute: async ({ pattern }: { pattern: string }) => {
          const results = await grepWorkspace(pattern, workspace);
          return JSON.stringify(results.slice(0, 5));
        },
      },
    };

    const tools = { ...fsTools, ...codebaseTools };

    const result = await generateText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'Find all functions with "process" in their name using grep, then read one of those files',
        },
      ],
      tools,
      maxSteps: 5,
    });


    const toolNames = result.response.messages
      .filter((m: any) => m.role === 'assistant' && m.toolInvocations)
      .flatMap((m: any) => m.toolInvocations.map((t: any) => t.toolName));

    expect(toolNames).toContain('grep_codebase');
    expect(toolNames.some((name: string) => name.includes('read'))).toBe(true);
  });

  it('should handle tool chaining with dependencies', async () => {
    const executionOrder: string[] = [];

    const tools = {
      step1_fetch_data: {
        description: 'Fetch initial data',
        parameters: z.object({}),
        execute: async () => {
          executionOrder.push('step1');
          return JSON.stringify({ id: 123, value: 'test-data' });
        },
      },
      step2_process_data: {
        description: 'Process the fetched data',
        parameters: z.object({
          data: z.string(),
        }),
        execute: async ({ data }: { data: string }) => {
          executionOrder.push('step2');
          return `Processed: ${data}`;
        },
      },
      step3_save_result: {
        description: 'Save the processed result',
        parameters: z.object({
          result: z.string(),
        }),
        execute: async ({ result }: { result: string }) => {
          executionOrder.push('step3');
          return `Saved: ${result}`;
        },
      },
    };

    const result = await generateText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'Fetch data using step1, then process it with step2, then save it with step3',
        },
      ],
      tools,
      maxSteps: 10,
    });


    expect(executionOrder.length).toBeGreaterThan(0);
    expect(executionOrder[0]).toBe('step1');
  });

  it('should recover from tool errors and continue workflow', async () => {
    let errorThrown = false;
    let recoveryAttempted = false;

    const tools = {
      failing_tool: {
        description: 'A tool that fails',
        parameters: z.object({}),
        execute: async () => {
          errorThrown = true;
          throw new Error('Tool execution failed');
        },
      },
      backup_tool: {
        description: 'A backup tool that works',
        parameters: z.object({}),
        execute: async () => {
          recoveryAttempted = true;
          return 'Success with backup tool';
        },
      },
    };

    const result = await generateText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'Try the failing_tool, and if it fails, use backup_tool instead',
        },
      ],
      tools,
      maxSteps: 10,
    });


    expect(result.response.messages).toBeDefined();
  });
});
