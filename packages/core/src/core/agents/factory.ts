import { ToolLoopAgent, smoothStream } from 'ai';

import { models } from './models.js';
import { systemPrompts, type AgentRole } from './roles.js';
import {
  buildSystemContext,
  buildDynamicSystemPrompt,
  type SystemContext,
} from '../../infrastructure/prompts/system-context.js';

export interface CreateAgentOptions {
  modelType?: keyof typeof models;
  stopWhen?: any;
  prepareStep?: any;
  onStepFinish?: any;
  workspaceRoot?: string;
  systemContext?: SystemContext;
}

export function createAgentWithRole(
  role: AgentRole,
  tools: Record<string, any>,
  options?: CreateAgentOptions
) {
  const modelType = options?.modelType || 'standard';
  
  const context = options?.systemContext || buildSystemContext(options?.workspaceRoot);
  const dynamicPrompt = buildDynamicSystemPrompt(systemPrompts[role], context);

  return new ToolLoopAgent({
    model: models[modelType](),
    instructions: dynamicPrompt,
    tools,
    stopWhen: options?.stopWhen,
    prepareStep: options?.prepareStep,
    onStepFinish: options?.onStepFinish,
  });
}

export { smoothStream };
export { models } from './models.js';
export { systemPrompts, type AgentRole } from './roles.js';
export { buildSystemContext, type SystemContext } from '../../infrastructure/prompts/system-context.js';
