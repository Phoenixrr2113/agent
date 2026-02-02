import { tool } from 'ai';

import { DEEP_REASONING_DESCRIPTION, UNRESTRICTED_MODE_DESCRIPTION } from './constants';
import { getDeepReasoningEngine, isDeepReasoningEnabled } from './engine';
import { deepReasoningInputSchema, type ThoughtData } from './types';

export function createDeepReasoningTool() {
  const description = isDeepReasoningEnabled()
    ? `${DEEP_REASONING_DESCRIPTION}\n\n${UNRESTRICTED_MODE_DESCRIPTION}`
    : DEEP_REASONING_DESCRIPTION;

  return tool({
    description,
    inputSchema: deepReasoningInputSchema,
    execute: async (input) => {
      const engine = getDeepReasoningEngine();
      const result = engine.processThought(input as ThoughtData);
      return JSON.stringify(result);
    },
  });
}

export const deepReasoningTool = createDeepReasoningTool();

export const sequentialThinkingTool = deepReasoningTool;
