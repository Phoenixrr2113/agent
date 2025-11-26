import { tool } from 'ai';
import { z } from 'zod';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { createStdioMCPClient, type MCPClientWrapper } from '../infrastructure/mcp/client.js';
import { createCodebaseRAG } from '../core/rag/index.js';
import { grepWorkspace } from '../core/search/grep.js';
import { planTool, validationTool } from '../tools/workflow.js';
import { logger } from '../core/logger.js';

const APPROVAL_MODE = process.env.APPROVAL_MODE || 'auto';

export interface InitializationResult {
  tools: Record<string, any>;
  mcpClients: Record<string, MCPClientWrapper>;
  usedClients: Set<string>;
  codebaseRAG: any;
  readline: readline.Interface | null;
}

export async function initializeAgent(): Promise<InitializationResult> {
  let rl: readline.Interface | null = null;
  if (APPROVAL_MODE === 'manual') {
    rl = readline.createInterface({ input, output });
  }

  logger.info(`🤖 Initializing AI Agent`, { approvalMode: APPROVAL_MODE });

  const usedClients = new Set<string>();

  const mcpClients = {
    filesystem: await createStdioMCPClient('node', ['node_modules/@modelcontextprotocol/server-filesystem/dist/index.js', process.cwd()]),
    git: await createStdioMCPClient('npx', ['-y', 'git-mcp-server']),
    fetch: await createStdioMCPClient('uvx', ['mcp-server-fetch']),
    memory: await createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-memory']),
    sequentialThinking: await createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-sequential-thinking']),
  };

  const filesystemTools = await mcpClients.filesystem.tools();
  const gitTools = await mcpClients.git.tools();
  const fetchTools = await mcpClients.fetch.tools();
  const memoryTools = await mcpClients.memory.tools();
  const sequentialThinkingTools = await mcpClients.sequentialThinking.tools();

  logger.info('Filesystem tools', { count: Object.keys(filesystemTools).length });
  logger.info('Git tools', { count: Object.keys(gitTools).length });
  logger.info('Fetch tools', { count: Object.keys(fetchTools).length });
  logger.info('Memory tools', { count: Object.keys(memoryTools).length });
  logger.info('Sequential thinking tools', { count: Object.keys(sequentialThinkingTools).length });

  function wrapToolsWithTracking(tools: Record<string, any>, clientName: string) {
    const wrapped: Record<string, any> = {};
    for (const [name, toolDef] of Object.entries(tools)) {
      const originalTool = toolDef as Record<string, any>;
      wrapped[name] = {
        ...originalTool,
        execute: async (...args: any[]) => {
          usedClients.add(clientName);
          return originalTool.execute(...args);
        },
      };
    }
    return wrapped;
  }

  const wrappedFilesystemTools = wrapToolsWithTracking(filesystemTools, 'filesystem');
  const wrappedGitTools = wrapToolsWithTracking(gitTools, 'git');
  const wrappedFetchTools = wrapToolsWithTracking(fetchTools, 'fetch');
  const wrappedMemoryTools = wrapToolsWithTracking(memoryTools, 'memory');
  const wrappedSequentialThinkingTools = wrapToolsWithTracking(sequentialThinkingTools, 'sequentialThinking');

  const codebaseRAG = createCodebaseRAG(process.cwd());
  logger.info('Indexing codebase...');
  await codebaseRAG.indexCodebase();
  const ragStats = codebaseRAG.getStats();
  logger.info('RAG indexed', { chunks: ragStats.totalChunks, files: ragStats.files });

  const codebaseTools = {
    search_codebase: tool({
      description: 'Search the indexed codebase for relevant code snippets using semantic search. Use this to find implementations, patterns, or understand how the codebase works.',
      inputSchema: z.object({
        query: z.string().describe('The search query to find relevant code'),
        topK: z.number().optional().describe('Number of results to return (default: 5)'),
      }),
      execute: async ({ query, topK = 5 }) => {
        const results = await codebaseRAG.searchCodebase(query, topK);
        return JSON.stringify(results.map(r => ({
          file: r.filePath,
          lines: `${r.startLine}-${r.endLine}`,
          content: r.content,
        })));
      },
    }),
    grep_codebase: tool({
      description: 'Search for exact text patterns in the codebase using regex. Use this for finding specific strings, function names, or patterns.',
      inputSchema: z.object({
        pattern: z.string().describe('The regex pattern to search for'),
        filePattern: z.string().optional().describe('Optional file pattern to filter (e.g., "*.ts")'),
        ignoreCase: z.boolean().optional().describe('Whether to ignore case (default: false)'),
        maxResults: z.number().optional().describe('Maximum number of results (default: 100)'),
      }),
      execute: async ({ pattern, filePattern, ignoreCase, maxResults }) => {
        const results = await grepWorkspace(pattern, process.cwd(), { filePattern, ignoreCase, maxResults });
        return JSON.stringify(results);
      },
    }),
    task_complete: tool({
      description: 'Call this when you have fully completed the user\'s request and have nothing more to do. This will end the current agent iteration.',
      inputSchema: z.object({
        summary: z.string().describe('A brief summary of what was accomplished'),
        nextSteps: z.string().optional().describe('Optional suggestions for what the user might want to do next'),
      }),
      execute: async ({ summary, nextSteps }) => {
        let result = `Task completed: ${summary}`;
        if (nextSteps) {
          result += `\n\nSuggested next steps: ${nextSteps}`;
        }
        return result;
      },
    }),
    ask_user: tool({
      description: 'Ask the user a question and wait for their response. Use this when you need clarification, approval, or additional information from the user.',
      inputSchema: z.object({
        question: z.string().describe('The question to ask the user'),
      }),
      execute: async ({ question }) => {
        if (APPROVAL_MODE === 'auto') {
          logger.info('🤖 Agent question (auto-approved)', { question });
          logger.warn('⚠️  Agent is running in auto-mode. To interact with the agent, use "pnpm chat" instead of "pnpm dev".');
          return 'yes';
        }

        if (APPROVAL_MODE === 'manual' && rl) {
          logger.info('🤔 Agent', { question });
          const answer = await rl.question('👤 You: ');
          return answer;
        }

        return 'Tool available but approval mode not configured';
      },
    }),
  };

  const tools = {
    plan_tool: planTool,
    validation_tool: validationTool,
    ...wrappedFilesystemTools,
    ...wrappedGitTools,
    ...wrappedFetchTools,
    ...wrappedMemoryTools,
    ...wrappedSequentialThinkingTools,
    ...codebaseTools,
  };

  logger.info('Total tools', { count: Object.keys(tools).length });

  return {
    tools,
    mcpClients,
    usedClients,
    codebaseRAG,
    readline: rl,
  };
}

export async function cleanup(mcpClients: Record<string, MCPClientWrapper>, usedClients: Set<string>, rl: readline.Interface | null) {
  logger.info('🧹 Cleaning up MCP clients...');
  if (usedClients.has('filesystem')) {
    await mcpClients.filesystem.close();
  }
  if (usedClients.has('git')) {
    await mcpClients.git.close();
  }
  if (usedClients.has('fetch')) {
    await mcpClients.fetch.close();
  }
  if (usedClients.has('memory')) {
    await mcpClients.memory.close();
  }
  if (usedClients.has('sequentialThinking')) {
    await mcpClients.sequentialThinking.close();
  }
  if (rl) {
    rl.close();
  }
}
