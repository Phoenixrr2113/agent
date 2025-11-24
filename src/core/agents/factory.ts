import { Experimental_Agent as Agent } from 'ai';
import { models } from './models.js';
import { systemPrompts, type AgentRole } from './roles.js';

export function createAgentWithRole(
  role: AgentRole,
  tools: Record<string, any>,
  options?: {
    modelType?: keyof typeof models;
    stopWhen?: any;
    prepareStep?: any;
    onStepFinish?: any;
  }
) {
  const modelType = options?.modelType || 'standard';

  return new Agent({
    model: models[modelType](),
    system: systemPrompts[role],
    tools,
    stopWhen: options?.stopWhen,
    prepareStep: options?.prepareStep,
    onStepFinish: options?.onStepFinish,
  });
}

export { models } from './models.js';
export { systemPrompts, type AgentRole } from './roles.js';
