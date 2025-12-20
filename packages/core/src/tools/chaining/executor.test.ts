import { describe, it, expect, vi } from 'vitest';
import { createChainExecutor } from './executor.js';
import type { ChainStep, ChainExecutorConfig } from './types.js';

function createMockTools() {
  return {
    read_file: {
      execute: vi.fn().mockResolvedValue({ content: 'file contents' }),
    },
    write_file: {
      execute: vi.fn().mockResolvedValue({ success: true }),
    },
    failing_tool: {
      execute: vi.fn().mockRejectedValue(new Error('Tool failed')),
    },
    slow_tool: {
      execute: vi.fn().mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 10));
        return { result: 'done' };
      }),
    },
  };
}

describe('createChainExecutor', () => {
  it('creates a chain and returns chainId', () => {
    const tools = createMockTools();
    const executor = createChainExecutor({ tools });

    const steps: ChainStep[] = [
      { id: 'step1', tool: 'read_file', args: { path: 'test.txt' } },
    ];

    const chain = executor.createChain('Test goal', steps);

    expect(chain.id).toBeDefined();
    expect(chain.goal).toBe('Test goal');
    expect(chain.status).toBe('ready');
    expect(chain.steps).toHaveLength(1);
  });

  it('executes chain steps in order', async () => {
    const tools = createMockTools();
    const executor = createChainExecutor({ tools });

    const steps: ChainStep[] = [
      { id: 'step1', tool: 'read_file', args: { path: 'test.txt' } },
      { id: 'step2', tool: 'write_file', args: { path: 'out.txt' } },
    ];

    const chain = executor.createChain('Multi-step test', steps);
    const result = await executor.executeChain(chain.id);

    expect(result.status).toBe('complete');
    expect(result.completedSteps).toHaveLength(2);
    expect(result.completedSteps[0]?.stepId).toBe('step1');
    expect(result.completedSteps[1]?.stepId).toBe('step2');
    expect(tools.read_file.execute).toHaveBeenCalledTimes(1);
    expect(tools.write_file.execute).toHaveBeenCalledTimes(1);
  });

  it('returns error when chain not found', async () => {
    const tools = createMockTools();
    const executor = createChainExecutor({ tools });

    const result = await executor.executeChain('nonexistent');

    expect(result.status).toBe('error');
    expect(result.failedStep?.error).toBe('Chain not found');
  });

  it('returns error when tool not found', async () => {
    const tools = createMockTools();
    const executor = createChainExecutor({ tools });

    const steps: ChainStep[] = [
      { id: 'step1', tool: 'nonexistent_tool', args: {} },
    ];

    const chain = executor.createChain('Missing tool test', steps);
    const result = await executor.executeChain(chain.id);

    expect(result.status).toBe('error');
    expect(result.failedStep?.error).toContain('Tool not found');
  });

  it('aborts on error by default', async () => {
    const tools = createMockTools();
    const executor = createChainExecutor({ tools });

    const steps: ChainStep[] = [
      { id: 'step1', tool: 'read_file', args: {} },
      { id: 'step2', tool: 'failing_tool', args: {} },
      { id: 'step3', tool: 'write_file', args: {} },
    ];

    const chain = executor.createChain('Abort test', steps);
    const result = await executor.executeChain(chain.id);

    expect(result.status).toBe('error');
    expect(result.completedSteps).toHaveLength(1);
    expect(result.failedStep?.stepId).toBe('step2');
    expect(result.remainingSteps).toEqual(['step3']);
    expect(tools.write_file.execute).not.toHaveBeenCalled();
  });

  it('skips step on error when configured', async () => {
    const tools = createMockTools();
    const executor = createChainExecutor({ tools });

    const steps: ChainStep[] = [
      { id: 'step1', tool: 'read_file', args: {} },
      { id: 'step2', tool: 'failing_tool', args: {}, onError: 'skip' },
      { id: 'step3', tool: 'write_file', args: {} },
    ];

    const chain = executor.createChain('Skip test', steps);
    const result = await executor.executeChain(chain.id);

    expect(result.status).toBe('complete');
    expect(result.completedSteps).toHaveLength(3);
    expect(result.completedSteps[1]?.success).toBe(false);
    expect(result.completedSteps[1]?.error).toContain('Skipped');
    expect(tools.write_file.execute).toHaveBeenCalled();
  });

  it('retries failed steps when configured', async () => {
    const tools = createMockTools();
    let callCount = 0;
    tools.failing_tool.execute = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Temporary failure');
      }
      return { success: true };
    });

    const executor = createChainExecutor({ tools });

    const steps: ChainStep[] = [
      { id: 'step1', tool: 'failing_tool', args: {}, maxRetries: 3 },
    ];

    const chain = executor.createChain('Retry test', steps);
    const result = await executor.executeChain(chain.id);

    expect(result.status).toBe('complete');
    expect(tools.failing_tool.execute).toHaveBeenCalledTimes(3);
  });

  it('calls onStepComplete callback', async () => {
    const tools = createMockTools();
    const onStepComplete = vi.fn();
    const executor = createChainExecutor({ tools, onStepComplete });

    const steps: ChainStep[] = [
      { id: 'step1', tool: 'read_file', args: {} },
    ];

    const chain = executor.createChain('Callback test', steps);
    await executor.executeChain(chain.id);

    expect(onStepComplete).toHaveBeenCalledTimes(1);
    expect(onStepComplete).toHaveBeenCalledWith(expect.objectContaining({
      stepId: 'step1',
      success: true,
    }));
  });

  it('calls onStepError callback on failure', async () => {
    const tools = createMockTools();
    const onStepError = vi.fn();
    const executor = createChainExecutor({ tools, onStepError });

    const steps: ChainStep[] = [
      { id: 'step1', tool: 'failing_tool', args: {} },
    ];

    const chain = executor.createChain('Error callback test', steps);
    await executor.executeChain(chain.id);

    expect(onStepError).toHaveBeenCalledTimes(1);
    expect(onStepError).toHaveBeenCalledWith(expect.objectContaining({
      stepId: 'step1',
      success: false,
    }));
  });

  it('cancels pending chain', () => {
    const tools = createMockTools();
    const executor = createChainExecutor({ tools });

    const steps: ChainStep[] = [
      { id: 'step1', tool: 'read_file', args: {} },
    ];

    const chain = executor.createChain('Cancel test', steps);
    expect(executor.getPendingCount()).toBe(1);

    const cancelled = executor.cancelChain(chain.id);
    expect(cancelled).toBe(true);
    expect(executor.getPendingCount()).toBe(0);
  });

  it('cannot cancel running or completed chain', async () => {
    const tools = createMockTools();
    const executor = createChainExecutor({ tools });

    const steps: ChainStep[] = [
      { id: 'step1', tool: 'read_file', args: {} },
    ];

    const chain = executor.createChain('Test', steps);
    await executor.executeChain(chain.id);

    const cancelled = executor.cancelChain(chain.id);
    expect(cancelled).toBe(false);
  });

  it('tracks duration for each step', async () => {
    const tools = createMockTools();
    const executor = createChainExecutor({ tools });

    const steps: ChainStep[] = [
      { id: 'step1', tool: 'slow_tool', args: {} },
    ];

    const chain = executor.createChain('Duration test', steps);
    const result = await executor.executeChain(chain.id);

    expect(result.completedSteps[0]?.durationMs).toBeGreaterThanOrEqual(10);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(10);
  });
});
