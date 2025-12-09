import type { ApiRouteConfig, ApiRouteHandler } from 'motia';
import { z } from 'zod';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Mobile Send Command',
  path: '/mobile/command',
  method: 'POST',
  bodySchema: z.object({
    type: z.string().min(1, 'type is required'),
    payload: z.any().optional(),
  }),
  emits: [],
  flows: ['mobile', 'agent-loop'],
};

export const handler: ApiRouteHandler = async (req, ctx) => {
  const { type, payload } = req.body as { type: string; payload?: unknown };

  await ctx.streams.agent.send(
    { groupId: `mobile:${type}` },
    {
      type: 'mobile_command',
      data: {
        status: 'mobile_command',
        toolName: type,
        toolInput: payload,
      },
    }
  );

  ctx.logger.info('Mobile command sent', { type, payload });

  return { status: 200, body: { success: true, type } };
};
