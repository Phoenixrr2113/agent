import { ToolLoopAgent, smoothStream } from 'ai';

import { models } from './models.js';
import { systemPrompts, buildSpawnedAgentPrompt, type AgentRole } from './roles.js';
import {
  buildSystemContext,
  buildDynamicSystemPrompt,
  type SystemContext,
} from '../../infrastructure/prompts/system-context.js';
import type { ProfileManager } from '../profile/types.js';

export interface CreateAgentOptions {
  modelType?: keyof typeof models;
  stopWhen?: any;
  prepareStep?: any;
  onStepFinish?: any;
  workspaceRoot?: string;
  systemContext?: SystemContext;
  isSpawnedAgent?: boolean;
  profileManager?: ProfileManager;
  userId?: string;
}

export function createAgentWithRole(
  role: AgentRole,
  tools: Record<string, any>,
  options?: CreateAgentOptions
) {
  const modelType = options?.modelType || 'standard';

  const includeWorkspaceMap = role === 'coder';
  const baseContext = options?.systemContext || buildSystemContext(options?.workspaceRoot, includeWorkspaceMap);
  
  const basePrompt = options?.isSpawnedAgent 
    ? buildSpawnedAgentPrompt(role) 
    : systemPrompts[role];
  
  // Build initial prompt (may not have profile yet)
  const initialPrompt = buildDynamicSystemPrompt(basePrompt, baseContext);

  // If we have a profile manager and userId, use prepareCall to dynamically refresh
  const model = models[modelType]();
  const prepareCall = options?.profileManager && options?.userId
    ? async () => {
        const freshProfile = await options.profileManager!.formatForSystemPrompt(options.userId!);
        const updatedContext = { ...baseContext, userProfileBlock: freshProfile };
        const updatedInstructions = buildDynamicSystemPrompt(basePrompt, updatedContext);
        return { model, instructions: updatedInstructions };
      }
    : undefined;

  return new ToolLoopAgent({
    model,
    instructions: initialPrompt,
    tools,
    stopWhen: options?.stopWhen,
    prepareStep: options?.prepareStep,
    onStepFinish: options?.onStepFinish,
    prepareCall,
  });
}

export { smoothStream };
export { models } from './models.js';
export { systemPrompts, type AgentRole } from './roles.js';
export { buildSystemContext, type SystemContext } from '../../infrastructure/prompts/system-context.js';

