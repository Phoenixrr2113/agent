import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { streamText } from 'ai';
import { createCodebaseRAG } from '../../src/rag.js';
import { grepWorkspace } from '../../src/grep.js';
import { getTestModel, hasModelProvider } from '../helpers/test-model.js';
import { z } from 'zod';
import path from 'path';

const hasGoogleAIKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

describe.skipIf(!hasModelProvider() || !hasGoogleAIKey)('Agent Self-Awareness E2E tests', () => {
  const projectRoot = path.join(process.cwd());

  it('should use search_codebase to understand its own implementation', async () => {
    const rag = createCodebaseRAG(projectRoot);
    await rag.indexCodebase();

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
              content: r.content.substring(0, 300),
            }))
          );
        },
      },
    };

    const result = streamText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'Search your own codebase for the RAG implementation',
        },
      ],
      tools: codebaseTools,
      maxSteps: 5,
    });

    const response = await result.response;

    const toolCalls = response.messages.filter(
      (m: any) => m.role === 'assistant' && m.toolInvocations
    );

    expect(toolCalls.length).toBeGreaterThan(0);

    const searchCalls = toolCalls.flatMap((m: any) =>
      m.toolInvocations.filter((t: any) => t.toolName === 'search_codebase')
    );

    expect(searchCalls.length).toBeGreaterThan(0);
  });

  it('should use grep to find specific patterns in its own code', async () => {
    const codebaseTools = {
      grep_codebase: {
        description: 'Search for patterns using regex',
        parameters: z.object({
          pattern: z.string(),
        }),
        execute: async ({ pattern }: { pattern: string }) => {
          const results = await grepWorkspace(pattern, projectRoot, { maxResults: 10 });
          return JSON.stringify(results);
        },
      },
    };

    const result = streamText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'Use grep to find all functions named "create" in the codebase',
        },
      ],
      tools: codebaseTools,
      maxSteps: 5,
    });

    const response = await result.response;

    const grepCalls = response.messages
      .filter((m: any) => m.role === 'assistant' && m.toolInvocations)
      .flatMap((m: any) =>
        m.toolInvocations.filter((t: any) => t.toolName === 'grep_codebase')
      );

    expect(grepCalls.length).toBeGreaterThan(0);
  });

  it('should assess its own capabilities using available tools', async () => {
    const rag = createCodebaseRAG(projectRoot);
    await rag.indexCodebase();

    const stats = rag.getStats();

    expect(stats.files).toBeGreaterThan(0);
    expect(stats.totalChunks).toBeGreaterThan(0);

    const searchResults = await rag.searchCodebase('MCP client implementation', 5);
    expect(searchResults.length).toBeGreaterThan(0);

    const grepResults = await grepWorkspace('createStdioMCPClient', projectRoot, {
      maxResults: 10,
    });
    expect(grepResults.length).toBeGreaterThan(0);
  });

  it('should understand its tool ecosystem', async () => {
    const toolInventory: string[] = [];

    const codebaseTools = {
      list_my_tools: {
        description: 'List all available tools',
        parameters: z.object({}),
        execute: async () => {
          return JSON.stringify({
            search: 'search_codebase - semantic search',
            grep: 'grep_codebase - pattern matching',
            filesystem: '15 filesystem tools for file operations',
            memory: '5 memory tools for knowledge graph',
            git: '10+ git tools for version control',
          });
        },
      },
      assess_capability: {
        description: 'Assess a specific capability',
        parameters: z.object({
          capability: z.string(),
        }),
        execute: async ({ capability }: { capability: string }) => {
          toolInventory.push(capability);
          return `Capability "${capability}" assessed`;
        },
      },
    };

    const result = streamText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'List your available tools, then assess your search capabilities',
        },
      ],
      tools: codebaseTools,
      maxSteps: 5,
    });

    await result.response;

    const hasListTools = result.response.messages.some(
      (m: any) =>
        m.role === 'assistant' &&
        m.toolInvocations?.some((t: any) => t.toolName === 'list_my_tools')
    );

    expect(hasListTools || toolInventory.length > 0).toBe(true);
  });

  it('should demonstrate end-to-end system validation', async () => {
    const rag = createCodebaseRAG(projectRoot);
    await rag.indexCodebase();

    const ragStats = rag.getStats();
    expect(ragStats.files).toBeGreaterThan(5);
    expect(ragStats.totalChunks).toBeGreaterThan(10);

    const semanticSearch = await rag.searchCodebase('embeddings and vector search', 3);
    expect(semanticSearch.length).toBeGreaterThan(0);

    const patternSearch = await grepWorkspace('embedMany', projectRoot);
    expect(patternSearch.length).toBeGreaterThan(0);

    const systemValidated = {
      rag: ragStats.totalChunks > 0,
      search: semanticSearch.length > 0,
      grep: patternSearch.length > 0,
    };

    expect(systemValidated.rag).toBe(true);
    expect(systemValidated.search).toBe(true);
    expect(systemValidated.grep).toBe(true);
  });

  it('should combine search and grep for comprehensive code understanding', async () => {
    const rag = createCodebaseRAG(projectRoot);
    await rag.indexCodebase();

    const semanticResults = await rag.searchCodebase('tool execution and calling', 5);

    const exactPatterns = await grepWorkspace('callTool', projectRoot, {
      maxResults: 10,
    });

    expect(semanticResults.length).toBeGreaterThan(0);
    expect(exactPatterns.length).toBeGreaterThan(0);

    const combinedInsight = {
      semanticUnderstanding: semanticResults.map(r => r.filePath),
      exactLocations: exactPatterns.map(r => r.file),
    };

    expect(combinedInsight.semanticUnderstanding.length).toBeGreaterThan(0);
    expect(combinedInsight.exactLocations.length).toBeGreaterThan(0);
  });

  it('should validate full agent stack integration', async () => {
    const rag = createCodebaseRAG(projectRoot);

    await rag.indexCodebase();

    const ragWorks = rag.getStats().totalChunks > 0;

    const grepWorks =
      (await grepWorkspace('function', projectRoot, { maxResults: 1 })).length > 0;

    const searchWorks = (await rag.searchCodebase('test', 1)).length > 0;

    const fullStackValidation = {
      indexing: ragWorks,
      patternMatching: grepWorks,
      semanticSearch: searchWorks,
      overallHealth: ragWorks && grepWorks && searchWorks,
    };

    expect(fullStackValidation.indexing).toBe(true);
    expect(fullStackValidation.patternMatching).toBe(true);
    expect(fullStackValidation.semanticSearch).toBe(true);
    expect(fullStackValidation.overallHealth).toBe(true);
  });
});
