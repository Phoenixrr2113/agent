import type { StepResult, PrepareStepFunction } from 'ai';
import { createAgentWithRole } from '../core/agents/factory.js';

const RUN_MODE = process.env.RUN_MODE || 'once';

export function createDynamicStopWhen(runMode: string = RUN_MODE) {
  return function dynamicStopWhen({ steps }: { steps: StepResult<any>[] }): boolean {
    const MAX_STEPS = runMode === 'loop' ? 20 : 50;

    const hasTaskComplete = steps.some(step =>
      step.toolCalls?.some(call => call.toolName === 'task_complete')
    );

    const maxStepsReached = steps.length >= MAX_STEPS;

    if (hasTaskComplete) {
      console.log('\n✅ Task marked as complete by agent');
    }

    if (maxStepsReached) {
      console.log(`\n⚠️  Reached maximum steps (${MAX_STEPS})`);
    }

    return hasTaskComplete || maxStepsReached;
  };
}

export function createPrepareStep<T>(): PrepareStepFunction<T> {
  return ({ messages }) => {
    const MAX_CONTEXT_MESSAGES = 50;

    if (messages.length > MAX_CONTEXT_MESSAGES) {
      console.log(`\n🔄 Trimming context: ${messages.length} → ${MAX_CONTEXT_MESSAGES} messages`);
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
    console.log(`\n📈 Step ${stepCount} finished`);

    if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
      const toolNames = stepResult.toolCalls.map((tc) => tc.toolName);
      console.log(`📊 Tools used: ${[...new Set(toolNames)].join(', ')}`);
    }
  };
}

export function createAgent(tools: Record<string, any>) {
  return createAgentWithRole('generic', tools, {
    modelType: 'standard',
    stopWhen: createDynamicStopWhen(),
    prepareStep: createPrepareStep(),
    onStepFinish: createStepFinishHandler(),
  });
}
