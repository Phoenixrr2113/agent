import { spawn } from 'child_process';
import { streamText, stepCountIs } from 'ai';
import type { ModelMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import fs from 'fs/promises';
import { systemPrompt } from './prompts.js';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

function createStdioMCPClient(command: string, args: string[]) {
  const proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] });
  let messageId = 0;
  const pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  let buffer = '';

  proc.stdout.on('data', (data: Buffer) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          if (message.id !== undefined && pendingRequests.has(message.id)) {
            const { resolve, reject } = pendingRequests.get(message.id)!;
            pendingRequests.delete(message.id);
            if (message.error) {
              reject(new Error(message.error.message || 'MCP error'));
            } else {
              resolve(message.result);
            }
          }
        } catch (e) {
          console.error('Failed to parse MCP message:', line, e);
        }
      }
    }
  });

  const sendRequest = async (method: string, params?: any): Promise<any> => {
    const id = ++messageId;
    const request = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      proc.stdin.write(JSON.stringify(request) + '\n');
    });
  };

  return {
    initialize: async () => {
      await sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'simple-mcp-client', version: '1.0.0' }
      });
    },
    listTools: async () => {
      const result = await sendRequest('tools/list');
      return result.tools || [];
    },
    callTool: async (name: string, args: any) => {
      const result = await sendRequest('tools/call', { name, arguments: args });
      return result;
    },
    close: () => {
      proc.kill();
    },
  };
}

const filesystemClient = createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/workspace']);
await filesystemClient.initialize();

const gitClient = createStdioMCPClient('npx', ['-y', 'git-mcp-server']);
await gitClient.initialize();

const fsMcpTools = await filesystemClient.listTools();
const gitMcpTools = await gitClient.listTools();

console.log('Filesystem tools:', fsMcpTools.length);
console.log('Git tools:', gitMcpTools.length);

const mapMcpToolsToAiTools = (mcpTools: any[], client: ReturnType<typeof createStdioMCPClient>) => {
  const tools: any = {};
  for (const mcpTool of mcpTools) {
    tools[mcpTool.name] = {
      description: mcpTool.description || '',
      parameters: z.any(),
      execute: async (args: any) => {
        const result = await client.callTool(mcpTool.name, args);
        return JSON.stringify(result.content);
      },
    };
  }
  return tools;
};

const filesystemTools = mapMcpToolsToAiTools(fsMcpTools, filesystemClient);
const gitTools = mapMcpToolsToAiTools(gitMcpTools, gitClient);

const tools = {
  ...filesystemTools,
  ...gitTools,
};

console.log('Total tools:', Object.keys(tools).length);

const history: ModelMessage[] = [
  {
    role: 'user',
    content: 'Start building yourself. Begin by assessing your current capabilities and planning what to build first.',
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
