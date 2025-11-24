import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateText } from 'ai';
import { createStdioMCPClient } from '../../src/mcp-client.js';
import { mapMcpToolsToAiTools } from '../../src/tools.js';
import { createCodebaseRAG } from '../../src/rag.js';
import { grepWorkspace } from '../../src/grep.js';
import { setupTestWorkspace, teardownTestWorkspace } from '../helpers/test-utils.js';
import { getTestModel, hasModelProvider } from '../helpers/test-model.js';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hasGoogleAIKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

describe.skipIf(!hasModelProvider() || !hasGoogleAIKey)('Agent E2E tests', () => {
  let workspace: string;
  let mcpClient: ReturnType<typeof createStdioMCPClient>;

  beforeEach(async () => {
    workspace = await setupTestWorkspace('e2e-agent');
    const serverPath = path.join(__dirname, '../helpers/test-mcp-server.ts');
    mcpClient = createStdioMCPClient('tsx', [serverPath]);
    await mcpClient.initialize();
  });

  afterEach(async () => {
    mcpClient.close();
    await teardownTestWorkspace(workspace);
  });

  it('should integrate RAG with codebase search', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const results = await rag.searchCodebase('calculate sum', 3);
    expect(results.length).toBeGreaterThan(0);

    const stats = rag.getStats();
    expect(stats.totalChunks).toBeGreaterThan(0);
    expect(stats.files).toBeGreaterThan(0);
  });

  it('should integrate grep with codebase search', async () => {
    const results = await grepWorkspace('function', workspace);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should integrate MCP tools with AI SDK tools', async () => {
    const mcpTools = await mcpClient.listTools();
    expect(mcpTools.length).toBeGreaterThan(0);

    const aiTools = mapMcpToolsToAiTools(mcpTools, mcpClient);
    expect(Object.keys(aiTools).length).toBe(mcpTools.length);

    const result = await aiTools.echo.execute({ message: 'test' });
    const parsed = JSON.parse(result);
    expect(parsed[0].text).toBe('test');
  });

  it('should combine all tools for agent use', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const mcpTools = await mcpClient.listTools();
    const aiMcpTools = mapMcpToolsToAiTools(mcpTools, mcpClient);

    const codebaseTools = {
      search_codebase: {
        description: 'Search the codebase',
        parameters: z.object({
          query: z.string(),
          topK: z.number().optional(),
        }),
        execute: async ({ query, topK = 5 }: { query: string; topK?: number }) => {
          const results = await rag.searchCodebase(query, topK);
          return JSON.stringify(results);
        },
      },
      grep_codebase: {
        description: 'Grep the codebase',
        parameters: z.object({
          pattern: z.string(),
        }),
        execute: async ({ pattern }: { pattern: string }) => {
          const results = await grepWorkspace(pattern, workspace);
          return JSON.stringify(results);
        },
      },
    };

    const allTools = {
      ...aiMcpTools,
      ...codebaseTools,
    };

    expect(Object.keys(allTools).length).toBeGreaterThan(4);
    expect(allTools).toHaveProperty('echo');
    expect(allTools).toHaveProperty('add');
    expect(allTools).toHaveProperty('search_codebase');
    expect(allTools).toHaveProperty('grep_codebase');
  });

  it('should perform full agent iteration with tools', async () => {
    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();

    const mcpTools = await mcpClient.listTools();
    const aiMcpTools = mapMcpToolsToAiTools(mcpTools, mcpClient);

    const codebaseTools = {
      search_codebase: {
        description: 'Search the codebase using semantic search',
        parameters: z.object({
          query: z.string(),
          topK: z.number().optional(),
        }),
        execute: async ({ query, topK = 5 }: { query: string; topK?: number }) => {
          const results = await rag.searchCodebase(query, topK);
          return JSON.stringify(results.map(r => ({
            file: r.filePath,
            lines: `${r.startLine}-${r.endLine}`,
            content: r.content,
          })));
        },
      },
    };

    const tools = { ...aiMcpTools, ...codebaseTools };

    const result = await generateText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'What is 5 plus 3?',
        },
      ],
      tools,
      maxSteps: 3,
    });

    expect(result).toBeDefined();
    expect(result.response.messages).toBeDefined();
  });

  it('should handle multiple tool calls in sequence', async () => {
    const result1 = await mcpClient.callTool('add', { a: 5, b: 3 });
    expect(result1.content[0].text).toBe('8');

    const result2 = await mcpClient.callTool('echo', { message: 'Hello' });
    expect(result2.content[0].text).toBe('Hello');

    const grepResults = await grepWorkspace('function', workspace);
    expect(grepResults.length).toBeGreaterThan(0);

    const rag = createCodebaseRAG(workspace);
    await rag.indexCodebase();
    const ragResults = await rag.searchCodebase('calculate', 3);
    expect(ragResults.length).toBeGreaterThan(0);
  });

  it('should re-index after each iteration', async () => {
    const rag = createCodebaseRAG(workspace);

    await rag.indexCodebase();
    const stats1 = rag.getStats();

    await rag.indexCodebase();
    const stats2 = rag.getStats();

    expect(stats2.totalChunks).toBeGreaterThanOrEqual(stats1.totalChunks);
  });
});
