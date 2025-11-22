import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { streamText, stepCountIs, CoreMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import fs from 'fs/promises';
import { systemPrompt } from './prompts.js';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

const graphitiClient = await createMCPClient({
  transport: {
    type: 'http',
    url: process.env.GRAPHITI_URL || 'http://graphiti-memory:8000/mcp/',
  },
});

const filesystemClient = await createMCPClient({
  transport: new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
  }),
});

const gitClient = await createMCPClient({
  transport: new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'mcp-server-git'],
  }),
});

const graphitiTools = await graphitiClient.tools();
const filesystemTools = await filesystemClient.tools();
const gitTools = await gitClient.tools();

const tools = {
  ...graphitiTools,
  ...filesystemTools,
  ...gitTools,
};

const history: CoreMessage[] = [];
let stopped = false;

while (!stopped) {
  const result = streamText({
    model: openrouter.chat(process.env.MODEL || 'meta-llama/llama-3.2-3b-instruct:free'),
    messages: history,
    tools,
    system: systemPrompt,
    stopWhen: stepCountIs(5),
    onFinish: async () => {
      await graphitiClient.close();
      await filesystemClient.close();
      await gitClient.close();
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
