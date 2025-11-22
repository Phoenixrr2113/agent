import { spawn, ChildProcess } from 'child_process';

export interface MCPClient {
  initialize: () => Promise<void>;
  listTools: () => Promise<any[]>;
  callTool: (name: string, args: any) => Promise<any>;
  close: () => void;
}

export function createStdioMCPClient(command: string, args: string[]): MCPClient {
  const proc: ChildProcess = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] });
  let messageId = 0;
  const pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  let buffer = '';

  proc.stdout!.on('data', (data: Buffer) => {
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
      proc.stdin!.write(JSON.stringify(request) + '\n');
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
