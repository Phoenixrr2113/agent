#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'test-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'echo',
        description: 'Echoes back the input',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to echo',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'add',
        description: 'Adds two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number' },
            b: { type: 'number' },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'error',
        description: 'Always throws an error',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

interface EchoArgs {
  message: string;
}

interface AddArgs {
  a: number;
  b: number;
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'echo': {
      const echoArgs = args as unknown as EchoArgs;
      return {
        content: [
          {
            type: 'text',
            text: echoArgs.message,
          },
        ],
      };
    }

    case 'add': {
      const addArgs = args as unknown as AddArgs;
      return {
        content: [
          {
            type: 'text',
            text: String(addArgs.a + addArgs.b),
          },
        ],
      };
    }

    case 'error':
      throw new Error('Test error from tool');

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
