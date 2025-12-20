import { randomUUID } from 'node:crypto';
import { logger } from '@agent/shared';
import type { Chain, ChainStep, ChainResult, StepResult, ChainExecutorConfig } from './types.js';

function resolveDependencies(
  step: ChainStep,
  results: Map<string, unknown>
): Record<string, unknown> {
  if (!step.dependsOn || step.dependsOn.length === 0) {
    return step.args;
  }

  const resolved = { ...step.args };
  for (const depId of step.dependsOn) {
    const depResult = results.get(depId);
    if (depResult !== undefined) {
      resolved[`$${depId}`] = depResult;
    }
  }
  return resolved;
}

export function createChainExecutor(config: ChainExecutorConfig) {
  const pendingChains = new Map<string, Chain>();

  function createChain(goal: string, steps: ChainStep[]): Chain {
    const chain: Chain = {
      id: randomUUID(),
      goal,
      steps,
      status: 'ready',
      results: new Map(),
      currentStepIndex: 0,
      createdAt: Date.now(),
    };
    pendingChains.set(chain.id, chain);
    return chain;
  }

  async function executeChain(chainId: string): Promise<ChainResult> {
    const chain = pendingChains.get(chainId);
    if (!chain) {
      return {
        chainId,
        status: 'error',
        completedSteps: [],
        failedStep: { stepId: '', tool: '', success: false, error: 'Chain not found', durationMs: 0 },
        totalDurationMs: 0,
      };
    }

    chain.status = 'running';
    const completedSteps: StepResult[] = [];
    const startTime = Date.now();

    for (let i = chain.currentStepIndex; i < chain.steps.length; i++) {
      const step = chain.steps[i];
      if (!step) continue;
      const stepStartTime = Date.now();

      const tool = config.tools[step.tool];
      if (!tool) {
        const failedStep: StepResult = {
          stepId: step.id,
          tool: step.tool,
          success: false,
          error: `Tool not found: ${step.tool}`,
          durationMs: Date.now() - stepStartTime,
        };
        config.onStepError?.(failedStep);

        chain.status = 'error';
        chain.currentStepIndex = i;

        return {
          chainId,
          status: 'error',
          completedSteps,
          failedStep,
          remainingSteps: chain.steps.slice(i + 1).map(s => s.id),
          totalDurationMs: Date.now() - startTime,
        };
      }

      const resolvedArgs = resolveDependencies(step, chain.results);

      let retries = 0;
      const maxRetries = step.maxRetries ?? 1;
      let lastError: string | undefined;

      while (retries < maxRetries) {
        try {
          logger.info(`⚡ Chain step ${i + 1}/${chain.steps.length}: ${step.tool}`, { stepId: step.id });
          const result = await tool.execute(resolvedArgs);
          chain.results.set(step.id, result);

          const stepResult: StepResult = {
            stepId: step.id,
            tool: step.tool,
            success: true,
            result,
            durationMs: Date.now() - stepStartTime,
          };
          completedSteps.push(stepResult);
          config.onStepComplete?.(stepResult);
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          retries++;

          if (retries < maxRetries) {
            logger.warn(`⚠️ Chain step failed, retrying (${retries}/${maxRetries})`, { stepId: step.id, error: lastError });
            continue;
          }

          const errorHandler = step.onError ?? 'abort';

          if (errorHandler === 'skip') {
            logger.info(`⏭️ Skipping failed step: ${step.id}`);
            const skippedStep: StepResult = {
              stepId: step.id,
              tool: step.tool,
              success: false,
              error: `Skipped after error: ${lastError}`,
              durationMs: Date.now() - stepStartTime,
            };
            completedSteps.push(skippedStep);
            break;
          }

          if (errorHandler === 'abort') {
            const failedStep: StepResult = {
              stepId: step.id,
              tool: step.tool,
              success: false,
              error: lastError,
              durationMs: Date.now() - stepStartTime,
            };
            config.onStepError?.(failedStep);

            chain.status = 'error';
            chain.currentStepIndex = i;

            return {
              chainId,
              status: 'error',
              completedSteps,
              failedStep,
              remainingSteps: chain.steps.slice(i + 1).map(s => s.id),
              totalDurationMs: Date.now() - startTime,
            };
          }
        }
      }
    }

    chain.status = 'complete';
    pendingChains.delete(chainId);

    return {
      chainId,
      status: 'complete',
      completedSteps,
      totalDurationMs: Date.now() - startTime,
    };
  }

  function getChain(chainId: string): Chain | undefined {
    return pendingChains.get(chainId);
  }

  function cancelChain(chainId: string): boolean {
    const chain = pendingChains.get(chainId);
    if (chain && chain.status === 'ready') {
      pendingChains.delete(chainId);
      return true;
    }
    return false;
  }

  return {
    createChain,
    executeChain,
    getChain,
    cancelChain,
    getPendingCount: () => pendingChains.size,
  };
}
