import type { StreamConfig } from 'motia';
import { z } from 'zod';

export const config: StreamConfig = {
  name: 'agent',
  schema: z.object({
    status: z.enum(['thinking', 'tool_calling', 'tool_result', 'responding', 'complete', 'error', 'mobile_command']),
    thought: z.string().optional(),
    toolName: z.string().optional(),
    toolInput: z.any().optional(),
    toolOutput: z.any().optional(),
    step: z.number().optional(),
    error: z.string().optional(),
    response: z.string().optional(),
  }),
  baseConfig: {
    storageType: 'default',
  },
};

