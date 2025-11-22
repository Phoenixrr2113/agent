import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { createStdioMCPClient } from './mcp-client.js';

const mockSpawn = vi.fn();

vi.mock('child_process', () => ({
  spawn: (cmd: string, args: string[], options: any) => mockSpawn(cmd, args, options),
}));

describe('createStdioMCPClient', () => {
  let mockProcess: any;

  beforeEach(() => {
    const stdout = new EventEmitter();
    const stdin = {
      write: vi.fn(),
    };

    mockProcess = {
      stdout,
      stdin,
      stderr: new EventEmitter(),
      kill: vi.fn(),
    };

    mockSpawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a client with correct command and args', () => {
    createStdioMCPClient('npx', ['-y', 'test-server']);

    expect(mockSpawn).toHaveBeenCalledWith('npx', ['-y', 'test-server'], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
  });

  it('should initialize with correct protocol version', async () => {
    const client = createStdioMCPClient('npx', ['-y', 'test-server']);

    setTimeout(() => {
      mockProcess.stdout.emit('data', Buffer.from(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { protocolVersion: '2024-11-05' }
        }) + '\n'
      ));
    }, 10);

    await client.initialize();

    expect(mockProcess.stdin.write).toHaveBeenCalledWith(
      expect.stringContaining('"method":"initialize"')
    );
    expect(mockProcess.stdin.write).toHaveBeenCalledWith(
      expect.stringContaining('"protocolVersion":"2024-11-05"')
    );
  });

  it('should list tools correctly', async () => {
    const client = createStdioMCPClient('npx', ['-y', 'test-server']);

    const mockTools = [
      { name: 'tool1', description: 'Test tool 1' },
      { name: 'tool2', description: 'Test tool 2' },
    ];

    setTimeout(() => {
      mockProcess.stdout.emit('data', Buffer.from(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { tools: mockTools }
        }) + '\n'
      ));
    }, 10);

    const tools = await client.listTools();

    expect(tools).toEqual(mockTools);
    expect(mockProcess.stdin.write).toHaveBeenCalledWith(
      expect.stringContaining('"method":"tools/list"')
    );
  });

  it('should call tool with correct arguments', async () => {
    const client = createStdioMCPClient('npx', ['-y', 'test-server']);

    const mockResult = { content: 'test result' };

    setTimeout(() => {
      mockProcess.stdout.emit('data', Buffer.from(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: mockResult
        }) + '\n'
      ));
    }, 10);

    const result = await client.callTool('testTool', { arg1: 'value1' });

    expect(result).toEqual(mockResult);
    expect(mockProcess.stdin.write).toHaveBeenCalledWith(
      expect.stringContaining('"method":"tools/call"')
    );
    expect(mockProcess.stdin.write).toHaveBeenCalledWith(
      expect.stringContaining('"name":"testTool"')
    );
  });

  it('should handle errors correctly', async () => {
    const client = createStdioMCPClient('npx', ['-y', 'test-server']);

    setTimeout(() => {
      mockProcess.stdout.emit('data', Buffer.from(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: { message: 'Test error' }
        }) + '\n'
      ));
    }, 10);

    await expect(client.listTools()).rejects.toThrow('Test error');
  });

  it('should close the process', () => {
    const client = createStdioMCPClient('npx', ['-y', 'test-server']);

    client.close();

    expect(mockProcess.kill).toHaveBeenCalled();
  });

  it('should handle multiple responses correctly', async () => {
    const client = createStdioMCPClient('npx', ['-y', 'test-server']);

    setTimeout(() => {
      mockProcess.stdout.emit('data', Buffer.from(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [] } }) + '\n'
      ));
    }, 10);

    setTimeout(() => {
      mockProcess.stdout.emit('data', Buffer.from(
        JSON.stringify({ jsonrpc: '2.0', id: 2, result: { content: 'test' } }) + '\n'
      ));
    }, 20);

    const tools = await client.listTools();
    const result = await client.callTool('test', {});

    expect(tools).toEqual([]);
    expect(result).toEqual({ content: 'test' });
  });

  it('should handle partial JSON messages', async () => {
    const client = createStdioMCPClient('npx', ['-y', 'test-server']);

    setTimeout(() => {
      mockProcess.stdout.emit('data', Buffer.from('{"jsonrpc":"2.0",'));
      mockProcess.stdout.emit('data', Buffer.from('"id":1,"result":{"tools":[]}}\n'));
    }, 10);

    const tools = await client.listTools();

    expect(tools).toEqual([]);
  });
});
