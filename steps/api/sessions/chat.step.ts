import type { ApiRouteConfig, ApiRouteHandler } from 'motia';
import { z } from 'zod';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Chat',
  path: '/sessions/:sessionId/chat',
  method: 'POST',
  bodySchema: z.object({
    message: z.string().min(1, 'Message is required'),
  }),
  emits: ['chat.started', 'agent.think'],
  flows: ['sessions', 'agent-loop'],
};

export const handler: ApiRouteHandler = async (req, ctx) => {
  const { sessionId } = req.pathParams as { sessionId: string };
  const { message } = req.body as { message: string };

  const sessionData = await ctx.state.get<{ createdAt: string }>('sessions', sessionId);

  if (!sessionData) {
    return {
      status: 404,
      body: { error: 'Session not found' },
    };
  }

  const historyData = await ctx.state.get<{ messages: any[] }>('sessions', `${sessionId}:history`);
  const existingMessages = historyData?.messages || [];
  const messages = [...existingMessages, { role: 'user', content: message }];

  await ctx.state.set('sessions', `${sessionId}:history`, { messages });

  await ctx.emit({
    topic: 'chat.started',
    data: { sessionId, message, traceId: ctx.traceId },
  });

  await ctx.emit({
    topic: 'agent.think',
    data: {
      sessionId,
      messages,
      step: 0,
    },
  });

  ctx.logger.info('Chat started - agent loop initiated', { sessionId, traceId: ctx.traceId });

  return {
    status: 202,
    body: {
      sessionId,
      traceId: ctx.traceId,
      status: 'processing',
      message: 'Request accepted. Subscribe to stream for updates.',
      streamUrl: `/streams/agent/${sessionId}`,
    },
  };
};
