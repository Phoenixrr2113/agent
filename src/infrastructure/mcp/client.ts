import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport as StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';

export interface MCPClientWrapper {
  tools: () => Promise<Record<string, any>>;
  close: () => Promise<void>;
}

export async function createStdioMCPClient(command: string, args: string[]): Promise<MCPClientWrapper> {
  const transport = new StdioMCPTransport({ command, args });
  const client = await createMCPClient({ transport });

  return {
    tools: async () => {
      return await client.tools();
    },
    close: async () => {
      await client.close();
    },
  };
}
