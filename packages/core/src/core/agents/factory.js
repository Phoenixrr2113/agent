import { ToolLoopAgent } from 'ai';
import { models } from './models.js';
import { systemPrompts } from './roles.js';
export function createAgentWithRole(role, tools, options) {
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
export { systemPrompts } from './roles.js';
