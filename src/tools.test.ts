import { describe, it, expect, vi } from 'vitest';
import { mapMcpToolsToAiTools } from './tools.js';
import type { MCPClient } from './mcp-client.js';

describe('mapMcpToolsToAiTools', () => {
  it('should map MCP tools to AI SDK tools correctly', () => {
    const mockClient: MCPClient = {
      initialize: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn(),
      close: vi.fn(),
    };

    const mcpTools = [
      {
        name: 'read_file',
        description: 'Read a file from the filesystem',
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
      },
    ];

    const aiTools = mapMcpToolsToAiTools(mcpTools, mockClient);

    expect(Object.keys(aiTools)).toHaveLength(2);
    expect(aiTools.read_file).toBeDefined();
    expect(aiTools.write_file).toBeDefined();
    expect(aiTools.read_file.description).toBe('Read a file from the filesystem');
    expect(aiTools.write_file.description).toBe('Write content to a file');
  });

  it('should handle empty tool descriptions', () => {
    const mockClient: MCPClient = {
      initialize: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn(),
      close: vi.fn(),
    };

    const mcpTools = [
      {
        name: 'test_tool',
      },
    ];

    const aiTools = mapMcpToolsToAiTools(mcpTools, mockClient);

    expect(aiTools.test_tool.description).toBe('');
  });

  it('should execute tool with correct arguments', async () => {
    const mockClient: MCPClient = {
      initialize: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'test result' }]
      }),
      close: vi.fn(),
    };

    const mcpTools = [
      {
        name: 'test_tool',
        description: 'Test tool',
      },
    ];

    const aiTools = mapMcpToolsToAiTools(mcpTools, mockClient);

    const result = await aiTools.test_tool.execute({ arg1: 'value1' });

    expect(mockClient.callTool).toHaveBeenCalledWith('test_tool', { arg1: 'value1' });
    expect(typeof result).toBe('string');
    expect(JSON.parse(result)).toEqual({
      content: [{ type: 'text', text: 'test result' }]
    });
  });

  it('should handle multiple tools', () => {
    const mockClient: MCPClient = {
      initialize: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn(),
      close: vi.fn(),
    };

    const mcpTools = [
      { name: 'tool1', description: 'Tool 1' },
      { name: 'tool2', description: 'Tool 2' },
      { name: 'tool3', description: 'Tool 3' },
    ];

    const aiTools = mapMcpToolsToAiTools(mcpTools, mockClient);

    expect(Object.keys(aiTools)).toHaveLength(3);
    expect(aiTools.tool1).toBeDefined();
    expect(aiTools.tool2).toBeDefined();
    expect(aiTools.tool3).toBeDefined();
  });

  it('should preserve tool names exactly', () => {
    const mockClient: MCPClient = {
      initialize: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn(),
      close: vi.fn(),
    };

    const mcpTools = [
      { name: 'read_file_with_underscores', description: 'Test' },
      { name: 'writeFileInCamelCase', description: 'Test' },
      { name: 'delete-file-with-dashes', description: 'Test' },
    ];

    const aiTools = mapMcpToolsToAiTools(mcpTools, mockClient);

    expect(aiTools['read_file_with_underscores']).toBeDefined();
    expect(aiTools['writeFileInCamelCase']).toBeDefined();
    expect(aiTools['delete-file-with-dashes']).toBeDefined();
  });

  it('should serialize complex return values', async () => {
    const mockClient: MCPClient = {
      initialize: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn().mockResolvedValue({
        content: {
          nested: {
            data: [1, 2, 3],
            object: { key: 'value' }
          }
        }
      }),
      close: vi.fn(),
    };

    const mcpTools = [{ name: 'complex_tool', description: 'Complex tool' }];
    const aiTools = mapMcpToolsToAiTools(mcpTools, mockClient);

    const result = await aiTools.complex_tool.execute({});
    const parsed = JSON.parse(result);

    expect(parsed.content.nested.data).toEqual([1, 2, 3]);
    expect(parsed.content.nested.object.key).toBe('value');
  });
});
