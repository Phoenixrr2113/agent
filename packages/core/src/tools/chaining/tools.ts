import { tool } from 'ai';
import { z } from 'zod';
import { createChainExecutor } from './executor.js';
import { success, error } from '../utils/tool-result.js';
import type { ChainStep, ChainExecutorConfig } from './types.js';

let executor: ReturnType<typeof createChainExecutor> | null = null;

export function initializeChainTools(config: ChainExecutorConfig) {
  executor = createChainExecutor(config);
}

export function getChainExecutor() {
  return executor;
}

export const planChainTool = tool({
  description: `Plan a sequence of tool calls to execute together.
Returns a chainId. Call await_chain(chainId) to execute and wait for all results.
Use dependsOn to pass results from previous steps. Use onError to control failure handling.`,
  inputSchema: z.object({
    goal: z.string().describe('What this chain accomplishes'),
    steps: z.array(z.object({
      id: z.string().describe('Unique step identifier'),
      tool: z.string().describe('Tool name to execute'),
      args: z.record(z.unknown()).describe('Arguments to pass to the tool'),
      dependsOn: z.array(z.string()).optional().describe('Step IDs whose results this step needs (accessible as $stepId)'),
      onError: z.enum(['retry', 'skip', 'abort']).optional().describe('What to do on error (default: abort)'),
      maxRetries: z.number().optional().describe('Max retry attempts (default: 1)'),
    })),
  }),
  execute: async ({ goal, steps }) => {
    if (!executor) {
      return error('Chain executor not initialized. Tools must be registered first.');
    }

    if (steps.length === 0) {
      return error('Chain must have at least one step');
    }

    if (steps.length > 20) {
      return error('Chain too large. Maximum 20 steps. Break into multiple chains or delegate to sub-agent.');
    }

    const chain = executor.createChain(goal, steps as ChainStep[]);

    return success({
      chainId: chain.id,
      status: 'ready',
      stepCount: steps.length,
      steps: steps.map(s => ({ id: s.id, tool: s.tool })),
    });
  },
});

export const awaitChainTool = tool({
  description: `Execute a planned chain and wait for results.
Returns all step results on success, or stops early on error with detailed failure info.
Use the results to decide next steps - retry failed steps, skip, or take alternative action.`,
  inputSchema: z.object({
    chainId: z.string().describe('Chain ID from plan_chain'),
  }),
  execute: async ({ chainId }) => {
    if (!executor) {
      return error('Chain executor not initialized');
    }

    const chain = executor.getChain(chainId);
    if (!chain) {
      return error('Chain not found', { chainId });
    }

    if (chain.status !== 'ready') {
      return error('Chain already executed or in progress', { chainId, status: chain.status });
    }

    const result = await executor.executeChain(chainId);

    if (result.status === 'complete') {
      return success({
        status: 'complete',
        stepsCompleted: result.completedSteps.length,
        results: result.completedSteps.map(s => ({
          stepId: s.stepId,
          tool: s.tool,
          result: s.result,
          durationMs: s.durationMs,
        })),
        totalDurationMs: result.totalDurationMs,
      });
    }

    return success({
      status: 'error',
      stepsCompleted: result.completedSteps.length,
      completedResults: result.completedSteps.map(s => ({
        stepId: s.stepId,
        tool: s.tool,
        result: s.result,
      })),
      failedStep: result.failedStep ? {
        stepId: result.failedStep.stepId,
        tool: result.failedStep.tool,
        error: result.failedStep.error,
      } : undefined,
      remainingSteps: result.remainingSteps,
      recommendation: 'Review the error and decide: retry with modified args, skip this step, or take alternative action.',
    });
  },
});

export const cancelChainTool = tool({
  description: 'Cancel a planned chain that has not yet started executing.',
  inputSchema: z.object({
    chainId: z.string().describe('Chain ID to cancel'),
  }),
  execute: async ({ chainId }) => {
    if (!executor) {
      return error('Chain executor not initialized');
    }

    const cancelled = executor.cancelChain(chainId);
    if (cancelled) {
      return success({ message: 'Chain cancelled', chainId });
    }
    return error('Cannot cancel chain - not found or already executing', { chainId });
  },
});

export const chainingTools = {
  plan_chain: planChainTool,
  await_chain: awaitChainTool,
  cancel_chain: cancelChainTool,
};
