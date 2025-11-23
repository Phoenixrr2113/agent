import 'dotenv/config';
import { streamText } from 'ai';
import type { CoreMessage, StepResult } from 'ai';
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

// Track which clients are initialized and used
const mcpClients = {
  filesystem: createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]),
  memory: createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-memory']),
};

const usedClients = new Set<string>();

await mcpClients.filesystem.initialize();
await mcpClients.memory.initialize();

const fsMcpTools = await mcpClients.filesystem.listTools();
const memoryMcpTools = await mcpClients.memory.listTools();

console.log(`✅ Loaded ${fsMcpTools.length} filesystem tools`);
console.log(`✅ Loaded ${memoryMcpTools.length} memory tools`);

// Wrap tools to track usage
function wrapToolsWithTracking(tools: any, clientName: string) {
  const wrapped: any = {};
  for (const [name, tool] of Object.entries(tools)) {
    wrapped[name] = {
      ...tool,
      execute: async (...args: any[]) => {
        usedClients.add(clientName);
        return (tool as any).execute(...args);
      },
    };
  }
  return wrapped;
}

const filesystemTools = wrapToolsWithTracking(
  mapMcpToolsToAiTools(fsMcpTools, mcpClients.filesystem),
  'filesystem'
);
const memoryTools = wrapToolsWithTracking(
  mapMcpToolsToAiTools(memoryMcpTools, mcpClients.memory),
  'memory'
);

const codebaseRAG = createCodebaseRAG(process.cwd());
console.log('\n📊 Indexing codebase with Gemini embeddings...');
await codebaseRAG.indexCodebase();
const ragStats = codebaseRAG.getStats();
console.log(`✅ Indexed ${ragStats.totalChunks} chunks from ${ragStats.files}\n`);

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
  task_complete: {
    description: 'Call this when you have fully completed the user\'s request and have nothing more to do. This will end the current response loop.',
    parameters: z.object({
      summary: z.string().describe('A brief summary of what was accomplished'),
    }),
    execute: async ({ summary }: { summary: string }) => {
      return `Task completed: ${summary}`;
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
console.log('🤖 Generic Agent Template');
console.log('━'.repeat(60));
console.log('This is a self-building agent that can become whatever you need.');
console.log('It will assess its capabilities and build itself for your purpose.');
console.log('\nType "exit" or "quit" to end the conversation');
console.log('━'.repeat(60) + '\n');

// Initial message: agent asks user what they want to build
const conversationHistory: CoreMessage[] = [
  {
    role: 'user',
    content: 'You are a generic agent template. Ask the user what kind of agent they want you to become, then start building yourself for that purpose. Begin by assessing your current capabilities and asking the user what they need.',
  },
];

// Custom stop condition: stop when task_complete is called or max steps reached
function stopWhen(result: StepResult<any>): boolean {
  const MAX_STEPS = 20;

  // Stop if task_complete was called
  const hasTaskComplete = result.toolCalls?.some(
    call => call.toolName === 'task_complete'
  );

  // Stop if we've reached max steps
  const maxStepsReached = result.stepCount >= MAX_STEPS;

  if (hasTaskComplete) {
    console.log('\n✅ Task marked as complete by agent');
  }

  if (maxStepsReached) {
    console.log(`\n⚠️  Reached maximum steps (${MAX_STEPS})`);
  }

  return hasTaskComplete || maxStepsReached;
}

async function chat() {
  // Send initial message to get agent started
  let isFirstMessage = true;

  while (true) {
    let userInput = '';

    if (!isFirstMessage) {
      userInput = await rl.question('👤 You: ');

      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
        console.log('\n👋 Goodbye!');
        cleanup();
        process.exit(0);
      }

      if (!userInput.trim()) {
        continue;
      }

      conversationHistory.push({
        role: 'user',
        content: userInput,
      });
    } else {
      isFirstMessage = false;
    }

    console.log('\n🤖 Agent: ');

    try {
      const result = streamText({
        model: openrouter.chat(process.env.MODEL || 'qwen/qwen3-coder:free'),
        messages: conversationHistory,
        tools,
        system: systemPrompt,
        stopWhen, // Dynamic stop condition!
        onFinish: async ({ response }) => {
          // Log which tools were used
          const toolsUsed = new Set<string>();
          response.messages.forEach(msg => {
            if (msg.role === 'assistant' && 'toolInvocations' in msg) {
              (msg as any).toolInvocations?.forEach((inv: any) => {
                toolsUsed.add(inv.toolName);
              });
            }
          });

          if (toolsUsed.size > 0) {
            console.log(`\n📊 Tools used: ${Array.from(toolsUsed).join(', ')}`);
          }

          console.log(`📈 Steps taken: ${response.steps}`);
        },
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

function cleanup() {
  console.log('\n🧹 Cleaning up...');

  // Only close clients that were actually used
  if (usedClients.has('filesystem')) {
    console.log('  └─ Closing filesystem client');
    mcpClients.filesystem.close();
  }
  if (usedClients.has('memory')) {
    console.log('  └─ Closing memory client');
    mcpClients.memory.close();
  }

  rl.close();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Caught interrupt signal');
  cleanup();
  process.exit(0);
});

chat().catch(error => {
  console.error('Fatal error:', error);
  cleanup();
  process.exit(1);
});
