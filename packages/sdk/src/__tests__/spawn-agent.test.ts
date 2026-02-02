/**
 * @agent/sdk - Spawn Agent Tool Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  createSpawnAgentTool, 
  spawnAgentParametersSchema,
  type SpawnAgentOptions,
  type SpawnAgentResult,
  type SubAgentStreamData,
} from '../tools/spawn-agent';

describe('spawnAgentParametersSchema', () => {
  it('should validate valid input', () => {
    const result = spawnAgentParametersSchema.safeParse({
      task: 'Write a function',
      role: 'coder',
    });
    expect(result.success).toBe(true);
  });

  it('should require task field', () => {
    const result = spawnAgentParametersSchema.safeParse({
      role: 'coder',
    });
    expect(result.success).toBe(false);
  });

  it('should default role to generic', () => {
    const result = spawnAgentParametersSchema.parse({
      task: 'Do something',
    });
    expect(result.role).toBe('generic');
  });

  it('should accept valid roles', () => {
    const roles = ['coder', 'researcher', 'analyst', 'generic'] as const;
    for (const role of roles) {
      const result = spawnAgentParametersSchema.safeParse({
        task: 'Task',
        role,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid roles', () => {
    const result = spawnAgentParametersSchema.safeParse({
      task: 'Task',
      role: 'invalid-role',
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional context', () => {
    const result = spawnAgentParametersSchema.parse({
      task: 'Task',
      context: 'Additional context here',
    });
    expect(result.context).toBe('Additional context here');
  });
});

describe('createSpawnAgentTool', () => {
  it('should create a tool with description and parameters', () => {
    const tool = createSpawnAgentTool();
    
    expect(tool).toHaveProperty('description');
    expect(tool).toHaveProperty('inputSchema');
    expect(tool).toHaveProperty('execute');
    expect(typeof tool.description).toBe('string');
    expect(tool.description.length).toBeGreaterThan(50);
  });

  it('should return error when no agent factory provided', async () => {
    const tool = createSpawnAgentTool();
    
    const result = await tool.execute({ 
      task: 'Test task', 
      role: 'coder' 
    }) as SpawnAgentResult;
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Agent factory not configured');
  });

  it('should return error when max depth exceeded', async () => {
    const tool = createSpawnAgentTool({
      maxSpawnDepth: 1,
      currentDepth: 1,
      createAgent: vi.fn(),
    });
    
    const result = await tool.execute({ 
      task: 'Test task', 
      role: 'coder' 
    }) as SpawnAgentResult;
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum spawn depth reached');
    expect(result.suggestion).toBeDefined();
  });

  it('should call createAgent with correct options', async () => {
    const mockCreateAgent = vi.fn().mockReturnValue({
      stream: () => ({
        fullStream: (async function* () {
          yield { type: 'text-delta', textDelta: 'Hello' };
        })(),
        text: Promise.resolve('Hello World'),
      }),
    });

    const tool = createSpawnAgentTool({
      maxSpawnDepth: 2,
      currentDepth: 0,
      createAgent: mockCreateAgent,
    });

    await tool.execute({ task: 'Write code', role: 'coder' });

    expect(mockCreateAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'coder',
        maxSpawnDepth: 0, // Sub-agents should have depth 0
      })
    );
  });

  it('should stream output via onStream callback', async () => {
    const streamedData: SubAgentStreamData[] = [];
    
    const mockCreateAgent = vi.fn().mockReturnValue({
      stream: () => ({
        fullStream: (async function* () {
          yield { type: 'text-delta', textDelta: 'Hello ' };
          yield { type: 'text-delta', textDelta: 'World' };
        })(),
        text: Promise.resolve('Hello World'),
      }),
    });

    const tool = createSpawnAgentTool({
      createAgent: mockCreateAgent,
      onStream: (data) => streamedData.push(data),
    });

    await tool.execute({ task: 'Test', role: 'generic' });

    // Should have: start, 2 deltas, complete
    expect(streamedData.length).toBeGreaterThanOrEqual(3);
    expect(streamedData[0].status).toBe('streaming');
    expect(streamedData[streamedData.length - 1].status).toBe('complete');
  });

  it('should return summary in result', async () => {
    const fullResponse = 'This is a long response that should be truncated in the summary...';
    
    const mockCreateAgent = vi.fn().mockReturnValue({
      stream: () => ({
        fullStream: (async function* () {
          yield { type: 'text-delta', textDelta: fullResponse };
        })(),
        text: Promise.resolve(fullResponse),
      }),
    });

    const tool = createSpawnAgentTool({
      createAgent: mockCreateAgent,
    });

    const result = await tool.execute({ 
      task: 'Test', 
      role: 'generic' 
    }) as SpawnAgentResult;

    expect(result.success).toBe(true);
    expect(result.summary).toBeDefined();
    expect(result.agentId).toBeDefined();
    expect(result.role).toBe('generic');
  });

  it('should include context in prompt when provided', async () => {
    let capturedPrompt = '';
    
    const mockCreateAgent = vi.fn().mockReturnValue({
      stream: (opts: { prompt: string }) => {
        capturedPrompt = opts.prompt;
        return {
          fullStream: (async function* () {})(),
          text: Promise.resolve('Done'),
        };
      },
    });

    const tool = createSpawnAgentTool({
      createAgent: mockCreateAgent,
    });

    await tool.execute({ 
      task: 'Do the thing', 
      role: 'coder',
      context: 'Here is some context',
    });

    expect(capturedPrompt).toContain('Context:');
    expect(capturedPrompt).toContain('Here is some context');
    expect(capturedPrompt).toContain('Do the thing');
  });

  it('should handle errors gracefully', async () => {
    const mockCreateAgent = vi.fn().mockReturnValue({
      stream: () => {
        // Create a promise that will be rejected but properly handled
        const rejectedPromise = Promise.resolve('').then(() => {
          throw new Error('Stream failed');
        });
        // Catch to prevent unhandled rejection warning
        rejectedPromise.catch(() => {});
        
        return {
          fullStream: (async function* () {
            throw new Error('Stream failed');
          })(),
          text: rejectedPromise,
        };
      },
    });

    const tool = createSpawnAgentTool({
      createAgent: mockCreateAgent,
    });

    const result = await tool.execute({ 
      task: 'Test', 
      role: 'generic' 
    }) as SpawnAgentResult;

    expect(result.success).toBe(false);
    expect(result.error).toContain('Stream failed');
  });
});
