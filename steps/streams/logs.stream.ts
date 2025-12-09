import type { StreamConfig } from 'motia'
import { z } from 'zod'

export const config: StreamConfig = {
  name: 'logs',
  schema: z.object({
    id: z.string(),
    sessionId: z.string(),
    traceId: z.string(),
    timestamp: z.number(),
    type: z.enum(['thought', 'tool_call', 'tool_result', 'response', 'error']),
    data: z.object({
      step: z.number().optional(),
      thought: z.string().optional(),
      toolName: z.string().optional(),
      toolInput: z.any().optional(),
      toolOutput: z.any().optional(),
      durationMs: z.number().optional(),
      error: z.string().optional(),
      response: z.string().optional(),
      responseLength: z.number().optional(),
      toolCallCount: z.number().optional(),
    }),
  }),
  baseConfig: {
    storageType: 'default',
  },
}
