import 'dotenv/config';
import { tool } from 'ai';
import type { StepResult, PrepareStepFunction, CoreMessage } from 'ai';
import { z } from 'zod';
import fs from 'fs/promises';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { createAgentWithRole, models } from './agents.js';
import { planTool, validationTool } from './agent-tools.js';
import { createStdioMCPClient } from './mcp-client.js';
import { mapMcpToolsToAiTools } from './tools.js';
import { createCodebaseRAG } from './rag.js';
import { grepWorkspace } from './grep.js';

const APPROVAL_MODE = process.env.APPROVAL_MODE || 'auto';
const RUN_MODE = process.env.RUN_MODE || 'once';

let rl: readline.Interface | null = null;
if (APPROVAL_MODE === 'manual') {
  rl = readline.createInterface({ input, output });
}

console.log(`🤖 Initializing AI Agent (approval: ${APPROVAL_MODE}, run: ${RUN_MODE})...\n`);

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
  ask_user: tool({
    description: 'Ask the user a question and wait for their response. Use this when you need clarification, approval, or additional information from the user.',
    inputSchema: z.object({
      question: z.string().describe('The question to ask the user'),
    }),
    execute: async ({ question }) => {
      if (APPROVAL_MODE === 'auto') {
        console.log(`\n🤖 Agent question (auto-approved): ${question}`);
        return 'yes';
      }

      if (APPROVAL_MODE === 'manual' && rl) {
        console.log(`\n🤔 Agent: ${question}`);
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
  ...filesystemTools,
  ...gitTools,
  ...fetchTools,
  ...memoryTools,
  ...sequentialThinkingTools,
  ...codebaseTools,
};

console.log('Total tools:', Object.keys(tools).length);

function dynamicStopWhen({ steps }: { steps: StepResult<any>[] }): boolean {
  const MAX_STEPS = RUN_MODE === 'loop' ? 20 : 50;

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

let stepCount = 0;

const agent = createAgentWithRole('generic', tools, {
  modelType: 'standard',
  stopWhen: dynamicStopWhen,
  prepareStep,
  onStepFinish: async (stepResult: StepResult<typeof tools>) => {
    stepCount++;
    console.log(`\n📈 Step ${stepCount} finished`);

    if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
      const toolNames = stepResult.toolCalls.map((tc) => tc.toolName);
      console.log(`📊 Tools used: ${[...new Set(toolNames)].join(', ')}`);
    }
  },
});

function cleanup() {
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
  if (rl) {
    rl.close();
  }
}

process.on('SIGINT', () => {
  console.log('\n\n👋 Caught interrupt signal');
  cleanup();
  process.exit(0);
});

if (RUN_MODE === 'loop') {
  await fs.mkdir('./logs', { recursive: true });

  console.log('━'.repeat(60));
  console.log('🤖 Generic Agent Template - Interactive Mode');
  console.log('━'.repeat(60));
  console.log('This is a self-building agent that can become whatever you need.');
  console.log('It will assess its capabilities and build itself for your purpose.');
  console.log('\nType "exit" or "quit" to end the conversation');
  console.log('━'.repeat(60) + '\n');

  const conversationHistory: CoreMessage[] = [
    {
      role: 'user',
      content: 'You are a generic agent template. Ask the user what kind of agent they want you to become, then start building yourself for that purpose. Begin by assessing your current capabilities and asking the user what they need.',
    },
  ];

  async function chat() {
    let isFirstMessage = true;

    while (true) {
      let userInput = '';

      if (!isFirstMessage) {
        if (!rl) {
          console.error('Readline interface not initialized');
          break;
        }
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
        const result = await agent.generate({
          messages: conversationHistory,
        });

        console.log(result.text);
        conversationHistory.push(...result.response.messages);

        // Log readable text output
        const timestamp = new Date().toISOString();
        await fs.appendFile('./logs/agent.log', `\n=== ${timestamp} ===\n${result.text}\n`);

        // Log detailed structured data
        const logEntry = {
          timestamp,
          text: result.text,
          steps: result.steps.map((step: any) => ({
            text: step.text,
            toolCalls: step.toolCalls?.map((tc: any) => ({
              name: tc.toolName,
              args: tc.args,
            })),
            toolResults: step.toolResults?.map((tr: any) => ({
              name: tr.toolName,
              result: typeof tr.result === 'string' ? tr.result.substring(0, 200) : tr.result,
            })),
            finishReason: step.finishReason,
          })),
          usage: result.totalUsage,
        };
        await fs.appendFile('./logs/iterations.jsonl', JSON.stringify(logEntry, null, 2) + '\n');

        console.log('\n');
      } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        await fs.appendFile('./logs/agent.log', `\n=== ERROR ${new Date().toISOString()} ===\n${error.message}\n${error.stack}\n`);
        console.log('\n');
      }
    }
  }

  chat().catch(error => {
    console.error('Fatal error:', error);
    cleanup();
    process.exit(1);
  });
} else {
  await fs.mkdir('./logs', { recursive: true });

  const result = await agent.generate({
    prompt: 'You are a generic agent template. Ask the user what kind of agent they want you to become, then start building yourself for that purpose. Begin by assessing your current capabilities.',
  });

  console.log(result.text);

  // Log readable text output
  const timestamp = new Date().toISOString();
  await fs.appendFile('./logs/agent.log', `\n=== ${timestamp} ===\n${result.text}\n`);

  // Log detailed structured data
  const logEntry = {
    timestamp,
    text: result.text,
    steps: result.steps.map((step: any) => ({
      text: step.text,
      toolCalls: step.toolCalls?.map((tc: any) => ({
        name: tc.toolName,
        args: tc.args,
      })),
      toolResults: step.toolResults?.map((tr: any) => ({
        name: tr.toolName,
        result: typeof tr.result === 'string' ? tr.result.substring(0, 200) : tr.result,
      })),
      finishReason: step.finishReason,
    })),
    usage: result.totalUsage,
  };
  await fs.appendFile('./logs/iterations.jsonl', JSON.stringify(logEntry, null, 2) + '\n');

  console.log('\n\nRe-indexing codebase after agent run...');
  await codebaseRAG.indexCodebase();
  const newStats = codebaseRAG.getStats();
  console.log(`RAG re-indexed: ${newStats.totalChunks} chunks from ${newStats.files} files`);

  cleanup();
}
