import type { StreamConfig } from 'motia';
import { z } from 'zod';

export const config: StreamConfig = {
  name: 'agent',
  schema: z.object({
    status: z.enum(['thinking', 'text_delta', 'tool_calling', 'tool_result', 'responding', 'complete', 'error', 'mobile_command']),
    thought: z.string().optional(),
    textDelta: z.string().optional(),
    toolName: z.string().optional(),
    toolInput: z.any().optional(),
    toolOutput: z.any().optional(),
    step: z.number().optional(),
    error: z.string().optional(),
    response: z.string().optional(),
    usage: z.object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalTokens: z.number(),
      reasoningTokens: z.number().optional(),
      cachedInputTokens: z.number().optional(),
    }).optional(),
    plan: z.object({
      title: z.string(),
      description: z.string().optional(),
      steps: z.array(z.object({
        id: z.string(),
        label: z.string(),
        status: z.enum(['pending', 'running', 'complete', 'error']),
      })),
    }).optional(),
    checkpoint: z.object({
      id: z.string(),
      label: z.string(),
      timestamp: z.string(),
    }).optional(),
    confirmation: z.object({
      id: z.string(),
      toolName: z.string(),
      message: z.string(),
      state: z.enum(['pending', 'approved', 'rejected']),
    }).optional(),
    citations: z.array(z.object({
      id: z.string(),
      text: z.string(),
      sources: z.array(z.object({
        title: z.string().optional(),
        url: z.string(),
        description: z.string().optional(),
      })),
    })).optional(),
  }),
  baseConfig: {
    storageType: 'default',
  },
};

