import type { ApiRouteConfig, ApiRouteHandler } from 'motia';
import { z } from 'zod';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Convenience Chat',
  path: '/chat',
  method: 'POST',
  bodySchema: z.object({
    message: z.string().min(1, 'Message is required'),
    sessionId: z.string().optional(),
  }),
  emits: ['session.created', 'chat.started', 'agent.think'],
  flows: ['chat', 'agent-loop'],
};

export const handler: ApiRouteHandler = async (req, ctx) => {
  const { message, sessionId: providedSessionId } = req.body as {
    message: string;
    sessionId?: string;
  };

  let sessionId = providedSessionId;
  let sessionData = sessionId
    ? await ctx.state.get<{ createdAt: string }>('sessions', sessionId)
    : null;

  if (!sessionData) {
    sessionId = crypto.randomUUID();

    await ctx.state.set('sessions', sessionId, {
      createdAt: new Date().toISOString(),
    });

    await ctx.state.set('sessions', `${sessionId}:history`, {
      messages: [],
    });

    await ctx.emit({ topic: 'session.created', data: { sessionId } });
    ctx.logger.info('Session auto-created', { sessionId });
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

  ctx.logger.info('Convenience chat started - agent loop initiated', { sessionId, traceId: ctx.traceId });

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
