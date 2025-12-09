import type { ApiRouteConfig, ApiRouteHandler } from 'motia';

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

  await ctx.state.set('sessions', sessionId, {
    createdAt: new Date().toISOString(),
  });

  await ctx.state.set('sessions', `${sessionId}:history`, {
    messages: [],
  });

  await ctx.emit({ topic: 'session.created', data: { sessionId } });

  ctx.logger.info('Session created', { sessionId });

  return {
    status: 201,
    body: { sessionId },
  };
};
