import type { ApiRouteConfig, ApiRouteHandler } from 'motia';
import { z } from 'zod';
import { createSession, getSession } from '../lib/session-store.js';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Convenience Chat',
  path: '/chat',
  method: 'POST',
  bodySchema: z.object({
    message: z.string().min(1, 'Message is required'),
    sessionId: z.string().optional(),
  }),
  emits: ['session.created', 'chat.started', 'chat.completed', 'memory.extract'],
  flows: ['chat'],
};

export const handler: ApiRouteHandler = async (req, ctx) => {
  const requestStartTime = performance.now();
  const { message, sessionId: providedSessionId } = req.body as {
    message: string;
    sessionId?: string;
  };

  let sessionId = providedSessionId;
  let session = sessionId ? getSession(sessionId) : undefined;

  if (!session) {
    sessionId = crypto.randomUUID();
    session = await createSession(sessionId);

    await ctx.state.set(sessionId, {
      createdAt: new Date().toISOString(),
    });

    await ctx.emit({ topic: 'session.created', data: { sessionId } });
    ctx.logger.info('Session auto-created', { sessionId });
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

  ctx.logger.info('Convenience chat completed', {
    sessionId,
    durationMs: requestDuration.toFixed(2),
    stepsUsed: result.stepsUsed,
  });

  return {
    status: 200,
    body: {
      sessionId,
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
