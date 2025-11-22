import { z } from 'zod';
import type { MCPClient } from './mcp-client.js';

export const mapMcpToolsToAiTools = (mcpTools: any[], client: MCPClient) => {
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
