import type { ApiRouteConfig, ApiRouteHandler } from 'motia';
import { createSession } from '../../lib/session-store.js';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Create Session',
  path: '/sessions',
  method: 'POST',
  emits: ['session.created'],
  flows: ['sessions'],
};

export const handler: ApiRouteHandler = async (_req, ctx) => {
  const sessionId = crypto.randomUUID();

  await createSession(sessionId);

  await ctx.state.set(sessionId, {
    createdAt: new Date().toISOString(),
  });

  await ctx.emit({ topic: 'session.created', data: { sessionId } });

  ctx.logger.info('Session created', { sessionId });

  return {
    status: 201,
    body: { sessionId },
  };
};
