import { ToolLoopAgent } from 'ai';
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

  return new ToolLoopAgent({
    model: models[modelType](),
    instructions: systemPrompts[role],
    tools,
    stopWhen: options?.stopWhen,
    prepareStep: options?.prepareStep,
    onStepFinish: options?.onStepFinish,
  });
}

export { models } from './models.js';
export { systemPrompts, type AgentRole } from './roles.js';
