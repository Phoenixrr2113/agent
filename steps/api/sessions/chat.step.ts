import type { ApiRouteConfig, ApiRouteHandler } from 'motia';
import { z } from 'zod';
import { getSession } from '../../lib/session-store.js';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Chat',
  path: '/sessions/:sessionId/chat',
  method: 'POST',
  bodySchema: z.object({
    message: z.string().min(1, 'Message is required'),
  }),
  emits: ['chat.started', 'chat.completed', 'memory.extract'],
  flows: ['sessions'],
};

export const handler: ApiRouteHandler = async (req, ctx) => {
  const requestStartTime = performance.now();
  const { sessionId } = req.pathParams as { sessionId: string };
  const { message } = req.body as { message: string };

  const session = getSession(sessionId);

  if (!session) {
    return {
      status: 404,
      body: { error: 'Session not found' },
    };
  }

  await ctx.emit({
    topic: 'chat.started',
    data: { sessionId, message },
  });

  const result = await session.send(message);
  const requestDuration = performance.now() - requestStartTime;

  await ctx.emit({
    topic: 'chat.completed',
    data: { sessionId, result },
  });

  await ctx.emit({
    topic: 'memory.extract',
    data: { sessionId, messages: session.getHistory() },
  });

  ctx.logger.info('Chat completed', {
    sessionId,
    durationMs: requestDuration.toFixed(2),
    stepsUsed: result.stepsUsed,
    toolsUsed: result.toolsUsed,
  });

  return {
    status: 200,
    body: {
      text: result.text,
      completed: result.completed,
      needsInput: result.needsInput,
      pendingQuestion: result.pendingQuestion,
      stepsUsed: result.stepsUsed,
      toolsUsed: result.toolsUsed,
      _timing: {
        totalRequestDurationMs: requestDuration.toFixed(2),
      },
    },
  };
};
