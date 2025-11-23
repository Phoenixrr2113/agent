import { Experimental_Agent as Agent, tool } from 'ai';
import type { StepResult, PrepareStepFunction } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import fs from 'fs/promises';
import { systemPrompt } from './prompts.js';
import { createStdioMCPClient } from './mcp-client.js';
import { mapMcpToolsToAiTools } from './tools.js';
import { createCodebaseRAG } from './rag.js';
import { grepWorkspace } from './grep.js';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

const usedClients = new Set<string>();

const mcpClients = {
  filesystem: createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]),
  git: createStdioMCPClient('npx', ['-y', 'git-mcp-server']),
  fetch: createStdioMCPClient('python3', ['-m', 'mcp_server_fetch']),
  memory: createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-memory']),
  sequentialThinking: createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-sequential-thinking']),
};

await mcpClients.filesystem.initialize();
await mcpClients.git.initialize();
await mcpClients.fetch.initialize();
await mcpClients.memory.initialize();
await mcpClients.sequentialThinking.initialize();

const fsMcpTools = await mcpClients.filesystem.listTools();
const gitMcpTools = await mcpClients.git.listTools();
const fetchMcpTools = await mcpClients.fetch.listTools();
const memoryMcpTools = await mcpClients.memory.listTools();
const sequentialThinkingMcpTools = await mcpClients.sequentialThinking.listTools();

console.log('Filesystem tools:', fsMcpTools.length);
console.log('Git tools:', gitMcpTools.length);
console.log('Fetch tools:', fetchMcpTools.length);
console.log('Memory tools:', memoryMcpTools.length);
console.log('Sequential thinking tools:', sequentialThinkingMcpTools.length);

function wrapToolsWithTracking(tools: Record<string, any>, clientName: string) {
  const wrapped: Record<string, any> = {};
  for (const [name, tool] of Object.entries(tools)) {
    const originalTool = tool as Record<string, any>;
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

const filesystemTools = wrapToolsWithTracking(
  mapMcpToolsToAiTools(fsMcpTools, mcpClients.filesystem),
  'filesystem'
);
const gitTools = wrapToolsWithTracking(
  mapMcpToolsToAiTools(gitMcpTools, mcpClients.git),
  'git'
);
const fetchTools = wrapToolsWithTracking(
  mapMcpToolsToAiTools(fetchMcpTools, mcpClients.fetch),
  'fetch'
);
const memoryTools = wrapToolsWithTracking(
  mapMcpToolsToAiTools(memoryMcpTools, mcpClients.memory),
  'memory'
);
const sequentialThinkingTools = wrapToolsWithTracking(
  mapMcpToolsToAiTools(sequentialThinkingMcpTools, mcpClients.sequentialThinking),
  'sequentialThinking'
);

const codebaseRAG = createCodebaseRAG(process.cwd());
console.log('Indexing codebase...');
await codebaseRAG.indexCodebase();
const ragStats = codebaseRAG.getStats();
console.log(`RAG indexed ${ragStats.totalChunks} chunks from ${ragStats.files} files`);

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
};

const tools = {
  ...filesystemTools,
  ...gitTools,
  ...fetchTools,
  ...memoryTools,
  ...sequentialThinkingTools,
  ...codebaseTools,
};

console.log('Total tools:', Object.keys(tools).length);

function dynamicStopWhen({ steps }: { steps: StepResult<any>[] }): boolean {
  const MAX_STEPS = 50;

  const hasTaskComplete = steps.some(step =>
    step.toolCalls?.some(call => call.toolName === 'task_complete')
  );

  const maxStepsReached = steps.length >= MAX_STEPS;

  if (hasTaskComplete) {
    console.log('\n✅ Task marked as complete by agent');
  }

  if (maxStepsReached) {
    console.log(`\n⚠️  Reached maximum steps (${MAX_STEPS})`);
  }

  return hasTaskComplete || maxStepsReached;
}

const prepareStep: PrepareStepFunction<typeof tools> = ({ messages }) => {
  const MAX_CONTEXT_MESSAGES = 50;

  if (messages.length > MAX_CONTEXT_MESSAGES) {
    console.log(`\n🔄 Trimming context: ${messages.length} → ${MAX_CONTEXT_MESSAGES} messages`);
    return {
      messages: [
        messages[0],
        ...messages.slice(-(MAX_CONTEXT_MESSAGES - 1)),
      ],
    };
  }

  return { messages };
};

await fs.mkdir('./logs', { recursive: true });

let stepCount = 0;

const agent = new Agent({
  model: openrouter.chat(process.env.MODEL || 'qwen/qwen3-coder:free'),
  system: systemPrompt,
  tools,
  stopWhen: dynamicStopWhen,
  prepareStep,
  onStepFinish: async (stepResult) => {
    stepCount++;
    console.log(`\n📈 Step ${stepCount} finished`);

    if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
      const toolNames = stepResult.toolCalls.map(tc => tc.toolName);
      console.log(`📊 Tools used: ${[...new Set(toolNames)].join(', ')}`);
    }
  },
});

const result = agent.stream({
  prompt: 'You are a generic agent template. Ask the user what kind of agent they want you to become, then start building yourself for that purpose. Begin by assessing your current capabilities.',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
  await fs.appendFile('./logs/agent.log', chunk);
}

const responseData = await result.response;

await fs.appendFile(
  './logs/iterations.jsonl',
  JSON.stringify({ timestamp: Date.now(), messages: responseData.messages }) + '\n'
);

console.log('\n\nRe-indexing codebase after agent run...');
await codebaseRAG.indexCodebase();
const newStats = codebaseRAG.getStats();
console.log(`RAG re-indexed: ${newStats.totalChunks} chunks from ${newStats.files} files`);

console.log('\n🧹 Cleaning up MCP clients...');
if (usedClients.has('filesystem')) {
  mcpClients.filesystem.close();
}
if (usedClients.has('git')) {
  mcpClients.git.close();
}
if (usedClients.has('fetch')) {
  mcpClients.fetch.close();
}
if (usedClients.has('memory')) {
  mcpClients.memory.close();
}
if (usedClients.has('sequentialThinking')) {
  mcpClients.sequentialThinking.close();
}
