import type { StepResult, PrepareStepFunction, StopCondition } from 'ai';
import { hasToolCall, stepCountIs } from 'ai';
import { createAgentWithRole } from '../core/agents/factory.js';
import { logger } from '../core/logger.js';

const RUN_MODE = process.env.RUN_MODE || 'once';

export function createStopConditions(runMode: string = RUN_MODE): StopCondition<any>[] {
  const MAX_STEPS = runMode === 'loop' ? 20 : 50;

  return [
    stepCountIs(MAX_STEPS),
    hasToolCall('task_complete'),
    hasToolCall('ask_user'),
  ];
}

export function createPrepareStep(): PrepareStepFunction<any> {
  return ({ messages }) => {
    const MAX_CONTEXT_MESSAGES = 50;

    if (messages.length > MAX_CONTEXT_MESSAGES) {
      logger.info('🔄 Trimming context', { from: messages.length, to: MAX_CONTEXT_MESSAGES });
      return {
        messages: [
          messages[0],
          ...messages.slice(-(MAX_CONTEXT_MESSAGES - 1)),
        ],
      };
    }

    return { messages };
  };
}

export function createStepFinishHandler() {
  let stepCount = 0;

  return async (stepResult: StepResult<any>) => {
    stepCount++;
    logger.info('📈 Step finished', { step: stepCount });

    if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
      const toolNames = stepResult.toolCalls.map((tc) => tc.toolName);
      logger.info('📊 Tools used', { tools: [...new Set(toolNames)].join(', ') });
    }
  };
}

export function createAgent(tools: Record<string, any>) {
  return createAgentWithRole('generic', tools, {
    modelType: 'standard',
    stopWhen: createStopConditions(),
    prepareStep: createPrepareStep(),
    onStepFinish: createStepFinishHandler(),
  });
}
