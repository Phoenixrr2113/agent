import { streamText, stepCountIs } from 'ai';
import type { ModelMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import fs from 'fs/promises';
import { systemPrompt } from './prompts.js';
import { createStdioMCPClient } from './mcp-client.js';
import { mapMcpToolsToAiTools } from './tools.js';

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

const tools = {
  ...filesystemTools,
  ...gitTools,
  ...fetchTools,
  ...memoryTools,
  ...sequentialThinkingTools,
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
}
