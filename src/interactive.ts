import 'dotenv/config';
import { streamText } from 'ai';
import type { CoreMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { systemPrompt } from './prompts.js';
import { createStdioMCPClient } from './mcp-client.js';
import { mapMcpToolsToAiTools } from './tools.js';
import { createCodebaseRAG } from './rag.js';
import { grepWorkspace } from './grep.js';

const rl = readline.createInterface({ input, output });

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

console.log('🤖 Initializing AI Agent with MCP tools...\n');

const filesystemClient = createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]);
await filesystemClient.initialize();

const memoryClient = createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-memory']);
await memoryClient.initialize();

const fsMcpTools = await filesystemClient.listTools();
const memoryMcpTools = await memoryClient.listTools();

console.log(`✅ Loaded ${fsMcpTools.length} filesystem tools`);
console.log(`✅ Loaded ${memoryMcpTools.length} memory tools`);

const filesystemTools = mapMcpToolsToAiTools(fsMcpTools, filesystemClient);
const memoryTools = mapMcpToolsToAiTools(memoryMcpTools, memoryClient);

const codebaseRAG = createCodebaseRAG(process.cwd());
console.log('\n📊 Indexing codebase with Gemini embeddings...');
await codebaseRAG.indexCodebase();
const ragStats = codebaseRAG.getStats();
console.log(`✅ Indexed ${ragStats.totalChunks} chunks from ${ragStats.files} files\n`);

const codebaseTools = {
  search_codebase: {
    description: 'Search the indexed codebase for relevant code snippets using semantic search. Use this to find implementations, patterns, or understand how the codebase works.',
    parameters: z.object({
      query: z.string().describe('The search query to find relevant code'),
      topK: z.number().optional().describe('Number of results to return (default: 5)'),
    }),
    execute: async ({ query, topK = 5 }: { query: string; topK?: number }) => {
      const results = await codebaseRAG.searchCodebase(query, topK);
      return JSON.stringify(results.map(r => ({
        file: r.filePath,
        lines: `${r.startLine}-${r.endLine}`,
        content: r.content.substring(0, 200),
      })));
    },
  },
  grep_codebase: {
    description: 'Search for exact text patterns in the codebase using regex. Use this for finding specific strings, function names, or patterns.',
    parameters: z.object({
      pattern: z.string().describe('The regex pattern to search for'),
      filePattern: z.string().optional().describe('Optional file pattern to filter (e.g., "*.ts")'),
      ignoreCase: z.boolean().optional().describe('Whether to ignore case (default: false)'),
      maxResults: z.number().optional().describe('Maximum number of results (default: 100)'),
    }),
    execute: async ({ pattern, filePattern, ignoreCase, maxResults }: {
      pattern: string;
      filePattern?: string;
      ignoreCase?: boolean;
      maxResults?: number;
    }) => {
      const results = await grepWorkspace(pattern, process.cwd(), { filePattern, ignoreCase, maxResults });
      return JSON.stringify(results.slice(0, 10));
    },
  },
  ask_user: {
    description: 'Ask the user a question and wait for their response. Use this when you need clarification, approval, or additional information from the user.',
    parameters: z.object({
      question: z.string().describe('The question to ask the user'),
    }),
    execute: async ({ question }: { question: string }) => {
      console.log(`\n🤔 Agent: ${question}`);
      const answer = await rl.question('👤 You: ');
      return answer;
    },
  },
};

const tools = {
  ...filesystemTools,
  ...memoryTools,
  ...codebaseTools,
};

console.log(`✅ Total tools available: ${Object.keys(tools).length}\n`);
console.log('━'.repeat(60));
console.log('🚀 Interactive AI Agent Ready!');
console.log('━'.repeat(60));
console.log('💡 Tips:');
console.log('  - Ask me to search the codebase, read files, or modify code');
console.log('  - I can use semantic search to find relevant code');
console.log('  - I\'ll ask you questions when I need clarification');
console.log('  - Type "exit" or "quit" to end the conversation');
console.log('━'.repeat(60) + '\n');

const conversationHistory: CoreMessage[] = [];

async function chat() {
  while (true) {
    const userInput = await rl.question('👤 You: ');

    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      console.log('\n👋 Goodbye!');
      filesystemClient.close();
      memoryClient.close();
      rl.close();
      process.exit(0);
    }

    if (!userInput.trim()) {
      continue;
    }

    conversationHistory.push({
      role: 'user',
      content: userInput,
    });

    console.log('\n🤖 Agent: ');

    try {
      const result = streamText({
        model: openrouter.chat(process.env.MODEL || 'qwen/qwen3-coder:free'),
        messages: conversationHistory,
        tools,
        system: systemPrompt,
        maxSteps: 10,
      });

      let fullResponse = '';
      for await (const chunk of result.textStream) {
        process.stdout.write(chunk);
        fullResponse += chunk;
      }

      const responseData = await result.response;
      conversationHistory.push(...responseData.messages);

      console.log('\n');
    } catch (error: any) {
      console.error('\n❌ Error:', error.message);
      console.log('\n');
    }
  }
}

chat().catch(error => {
  console.error('Fatal error:', error);
  filesystemClient.close();
  memoryClient.close();
  rl.close();
  process.exit(1);
});
