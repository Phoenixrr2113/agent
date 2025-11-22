import { streamText, stepCountIs } from 'ai';
import type { ModelMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import fs from 'fs/promises';
import { systemPrompt } from './prompts.js';
import { createStdioMCPClient } from './mcp-client.js';
import { mapMcpToolsToAiTools } from './tools.js';
import { createCodebaseRAG } from './rag.js';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

const filesystemClient = createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/workspace']);
await filesystemClient.initialize();

const gitClient = createStdioMCPClient('npx', ['-y', 'git-mcp-server']);
await gitClient.initialize();

const fetchClient = createStdioMCPClient('python3', ['-m', 'mcp_server_fetch']);
await fetchClient.initialize();

const memoryClient = createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-memory']);
await memoryClient.initialize();

const sequentialThinkingClient = createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-sequential-thinking']);
await sequentialThinkingClient.initialize();

const fsMcpTools = await filesystemClient.listTools();
const gitMcpTools = await gitClient.listTools();
const fetchMcpTools = await fetchClient.listTools();
const memoryMcpTools = await memoryClient.listTools();
const sequentialThinkingMcpTools = await sequentialThinkingClient.listTools();

console.log('Filesystem tools:', fsMcpTools.length);
console.log('Git tools:', gitMcpTools.length);
console.log('Fetch tools:', fetchMcpTools.length);
console.log('Memory tools:', memoryMcpTools.length);
console.log('Sequential thinking tools:', sequentialThinkingMcpTools.length);

const filesystemTools = mapMcpToolsToAiTools(fsMcpTools, filesystemClient);
const gitTools = mapMcpToolsToAiTools(gitMcpTools, gitClient);
const fetchTools = mapMcpToolsToAiTools(fetchMcpTools, fetchClient);
const memoryTools = mapMcpToolsToAiTools(memoryMcpTools, memoryClient);
const sequentialThinkingTools = mapMcpToolsToAiTools(sequentialThinkingMcpTools, sequentialThinkingClient);

const codebaseRAG = createCodebaseRAG('/workspace');
console.log('Indexing codebase...');
await codebaseRAG.indexCodebase();
const ragStats = codebaseRAG.getStats();
console.log(`RAG indexed ${ragStats.totalChunks} chunks from ${ragStats.files} files`);

const ragTools = {
  search_codebase: {
    description: 'Search the indexed codebase for relevant code snippets. Use this to find implementations, patterns, or understand how the codebase works.',
    parameters: z.object({
      query: z.string().describe('The search query to find relevant code'),
      topK: z.number().optional().describe('Number of results to return (default: 5)'),
    }),
    execute: async ({ query, topK = 5 }: { query: string; topK?: number }) => {
      const results = await codebaseRAG.searchCodebase(query, topK);
      return JSON.stringify(results.map(r => ({
        file: r.filePath,
        lines: `${r.startLine}-${r.endLine}`,
        content: r.content,
      })));
    },
  },
  reindex_codebase: {
    description: 'Re-index the codebase after making changes. Use this after modifying files to update the search index.',
    parameters: z.object({}),
    execute: async () => {
      await codebaseRAG.indexCodebase();
      const stats = codebaseRAG.getStats();
      return JSON.stringify({
        message: 'Codebase re-indexed successfully',
        stats,
      });
    },
  },
};

const tools = {
  ...filesystemTools,
  ...gitTools,
  ...fetchTools,
  ...memoryTools,
  ...sequentialThinkingTools,
  ...ragTools,
};

console.log('Total tools:', Object.keys(tools).length);

const history: ModelMessage[] = [
  {
    role: 'user',
    content: 'You are a generic agent template. Ask the user what kind of agent they want you to become, then start building yourself for that purpose. Begin by assessing your current capabilities.',
  },
];
let stopped = false;

while (!stopped) {
  const result = streamText({
    model: openrouter.chat(process.env.MODEL || 'qwen/qwen3-coder:free'),
    messages: history,
    tools,
    system: systemPrompt,
    stopWhen: stepCountIs(5),
    onFinish: async () => {
      filesystemClient.close();
      gitClient.close();
      fetchClient.close();
      memoryClient.close();
      sequentialThinkingClient.close();
    },
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
    await fs.appendFile('./logs/agent.log', chunk);
  }

  const responseData = await result.response;
  history.push(...responseData.messages);

  await fs.appendFile(
    './logs/iterations.jsonl',
    JSON.stringify({ timestamp: Date.now(), messages: responseData.messages }) + '\n'
  );

  console.log('\nRe-indexing codebase after iteration...');
  await codebaseRAG.indexCodebase();
  const newStats = codebaseRAG.getStats();
  console.log(`RAG re-indexed: ${newStats.totalChunks} chunks from ${newStats.files} files`);
}
