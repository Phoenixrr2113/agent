import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStdioMCPClient } from '../../src/infrastructure/mcp/client.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MCP Client integration tests', () => {
  let client: ReturnType<typeof createStdioMCPClient>;

  beforeEach(() => {
    const serverPath = path.join(__dirname, '../helpers/test-mcp-server.ts');
    client = createStdioMCPClient('tsx', [serverPath]);
  });

  afterEach(() => {
    client.close();
  });

  it('should initialize with a real MCP server', async () => {
    await expect(client.initialize()).resolves.not.toThrow();
  });

  it('should list tools from real MCP server', async () => {
    await client.initialize();
    const tools = await client.listTools();

    expect(tools).toHaveLength(3);
    expect(tools.map(t => t.name)).toContain('echo');
    expect(tools.map(t => t.name)).toContain('add');
    expect(tools.map(t => t.name)).toContain('error');
  });

  it('should call echo tool successfully', async () => {
    await client.initialize();
    const result = await client.callTool('echo', { message: 'Hello, MCP!' });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Hello, MCP!',
      },
    ]);
  });

  it('should call add tool and return correct result', async () => {
    await client.initialize();
    const result = await client.callTool('add', { a: 5, b: 3 });

    expect(result.content).toEqual([
      {
        type: 'text',
        text: '8',
      },
    ]);
  });

  it('should handle multiple sequential tool calls', async () => {
    await client.initialize();

    const result1 = await client.callTool('echo', { message: 'First call' });
    const result2 = await client.callTool('echo', { message: 'Second call' });
    const result3 = await client.callTool('add', { a: 10, b: 20 });

    expect(result1.content[0].text).toBe('First call');
    expect(result2.content[0].text).toBe('Second call');
    expect(result3.content[0].text).toBe('30');
  });

  it('should handle tool errors gracefully', async () => {
    await client.initialize();

    await expect(client.callTool('error', {})).rejects.toThrow();
  });

  it('should handle unknown tool calls', async () => {
    await client.initialize();

    await expect(client.callTool('nonexistent', {})).rejects.toThrow();
  });

  it('should handle complex arguments', async () => {
    await client.initialize();
    const result = await client.callTool('echo', {
      message: 'Complex message with "quotes" and\nnewlines',
    });

    expect(result.content[0].text).toContain('quotes');
    expect(result.content[0].text).toContain('newlines');
  });

  it('should verify tool schemas', async () => {
    await client.initialize();
    const tools = await client.listTools();

    const echoTool = tools.find(t => t.name === 'echo');
    expect(echoTool).toBeDefined();
    expect(echoTool!.description).toBe('Echoes back the input');
    expect(echoTool!.inputSchema).toBeDefined();

    const addTool = tools.find(t => t.name === 'add');
    expect(addTool).toBeDefined();
    expect(addTool!.description).toBe('Adds two numbers');
  });

  it('should close connection cleanly', async () => {
    await client.initialize();
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);

    expect(() => client.close()).not.toThrow();
  });
});
