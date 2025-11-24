import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { streamText } from 'ai';
import { createStdioMCPClient } from '../../src/mcp-client.js';
import { mapMcpToolsToAiTools } from '../../src/tools.js';
import { setupTestWorkspace, teardownTestWorkspace, writeTestFile } from '../helpers/test-utils.js';
import { getTestModel, hasModelProvider } from '../helpers/test-model.js';
import path from 'path';

describe.skipIf(!hasModelProvider())('Real MCP Servers E2E tests', () => {
  let workspace: string;
  let filesystemClient: ReturnType<typeof createStdioMCPClient>;
  let memoryClient: ReturnType<typeof createStdioMCPClient>;

  beforeEach(async () => {
    workspace = await setupTestWorkspace('e2e-mcp-servers');
    filesystemClient = createStdioMCPClient('npx', [
      '-y',
      '@modelcontextprotocol/server-filesystem',
      workspace,
    ]);
    memoryClient = createStdioMCPClient('npx', ['-y', '@modelcontextprotocol/server-memory']);

    await filesystemClient.initialize();
    await memoryClient.initialize();
  });

  afterEach(async () => {
    filesystemClient.close();
    memoryClient.close();
    await teardownTestWorkspace(workspace);
  });

  it('should use filesystem server to read and write files', async () => {
    const fsMcpTools = await filesystemClient.listTools();
    const fsTools = mapMcpToolsToAiTools(fsMcpTools, filesystemClient);

    expect(Object.keys(fsTools).length).toBeGreaterThan(0);

    const testFile = path.join(workspace, 'test.txt');

    const writeResult = await filesystemClient.callTool('write_file', {
      path: testFile,
      content: 'Hello from MCP filesystem server',
    });

    expect(writeResult.content).toBeDefined();

    const readResult = await filesystemClient.callTool('read_file', {
      path: testFile,
    });

    expect(readResult.content[0].text).toContain('Hello from MCP filesystem server');
  });

  it('should use filesystem server to list directory contents', async () => {
    await writeTestFile(workspace, 'file1.txt', 'content1');
    await writeTestFile(workspace, 'file2.txt', 'content2');

    const result = await filesystemClient.callTool('list_directory', {
      path: workspace,
    });

    const content = result.content[0].text;
    expect(content).toContain('file1.txt');
    expect(content).toContain('file2.txt');
  });

  it('should use memory server to create and retrieve entities', async () => {
    const memoryTools = await memoryClient.listTools();
    expect(memoryTools.length).toBeGreaterThan(0);

    const entityNames = memoryTools.map(t => t.name);
    expect(entityNames).toContain('create_entities');

    const createResult = await memoryClient.callTool('create_entities', {
      entities: [
        {
          name: 'Test Project',
          entityType: 'project',
          observations: ['This is a test project for E2E testing'],
        },
      ],
    });

    expect(createResult.content).toBeDefined();
  });

  it('should use memory server to create relations between entities', async () => {
    await memoryClient.callTool('create_entities', {
      entities: [
        {
          name: 'Alice',
          entityType: 'person',
          observations: ['Developer'],
        },
        {
          name: 'GenericAgent',
          entityType: 'project',
          observations: ['AI agent template'],
        },
      ],
    });

    const relResult = await memoryClient.callTool('create_relations', {
      relations: [
        {
          from: 'Alice',
          to: 'GenericAgent',
          relationType: 'works_on',
        },
      ],
    });

    expect(relResult.content).toBeDefined();
  });

  it('should combine filesystem and memory in agent workflow', async () => {
    const fsMcpTools = await filesystemClient.listTools();
    const memoryMcpTools = await memoryClient.listTools();

    const fsTools = mapMcpToolsToAiTools(fsMcpTools, filesystemClient);
    const memTools = mapMcpToolsToAiTools(memoryMcpTools, memoryClient);

    const allTools = { ...fsTools, ...memTools };

    expect(Object.keys(allTools).length).toBeGreaterThan(10);

    const testFile = path.join(workspace, 'data.json');

    const result = streamText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: `Write a JSON file to ${testFile} with {"name": "test", "value": 42}, then create a memory entity about this file`,
        },
      ],
      tools: allTools,
      maxSteps: 10,
    });

    const response = await result.response;

    const toolNames = response.messages
      .filter((m: any) => m.role === 'assistant' && m.toolInvocations)
      .flatMap((m: any) => m.toolInvocations.map((t: any) => t.toolName));

    const hasFilesystem = toolNames.some((name: string) => name.includes('write') || name.includes('read'));
    const hasMemory = toolNames.some((name: string) => name.includes('entities') || name.includes('create'));

    expect(hasFilesystem || hasMemory).toBe(true);
  });

  it('should handle multiple clients simultaneously', async () => {
    const fsMcpTools = await filesystemClient.listTools();
    const memoryMcpTools = await memoryClient.listTools();

    expect(fsMcpTools.length).toBeGreaterThan(0);
    expect(memoryMcpTools.length).toBeGreaterThan(0);

    const fsResult = await filesystemClient.callTool('write_file', {
      path: path.join(workspace, 'multi-client.txt'),
      content: 'Testing multiple clients',
    });

    const memResult = await memoryClient.callTool('create_entities', {
      entities: [
        {
          name: 'MultiClient Test',
          entityType: 'test',
          observations: ['Testing simultaneous clients'],
        },
      ],
    });

    expect(fsResult.content).toBeDefined();
    expect(memResult.content).toBeDefined();
  });

  it('should properly close all MCP client connections', async () => {
    const fsMcpTools = await filesystemClient.listTools();
    const memoryMcpTools = await memoryClient.listTools();

    expect(fsMcpTools.length).toBeGreaterThan(0);
    expect(memoryMcpTools.length).toBeGreaterThan(0);

    expect(() => filesystemClient.close()).not.toThrow();
    expect(() => memoryClient.close()).not.toThrow();
  });

  it('should handle tool execution with complex arguments', async () => {
    const testPath = path.join(workspace, 'complex.json');
    const complexData = {
      nested: {
        array: [1, 2, 3],
        object: { key: 'value' },
      },
      string: 'test with "quotes" and\nnewlines',
    };

    const result = await filesystemClient.callTool('write_file', {
      path: testPath,
      content: JSON.stringify(complexData, null, 2),
    });

    expect(result.content).toBeDefined();

    const readResult = await filesystemClient.callTool('read_file', {
      path: testPath,
    });

    const readContent = readResult.content[0].text;
    expect(readContent).toContain('nested');
    expect(readContent).toContain('quotes');
  });
});
