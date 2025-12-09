import type { ApiRouteConfig, ApiRouteHandler } from 'motia';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Clear History',
  path: '/sessions/:sessionId/clear',
  method: 'POST',
  emits: ['session.cleared'],
  flows: ['sessions'],
};

export const handler: ApiRouteHandler = async (req, ctx) => {
  const { sessionId } = req.pathParams as { sessionId: string };

  const sessionData = await ctx.state.get<{ createdAt: string }>('sessions', sessionId);

  if (!sessionData) {
    return {
      status: 404,
      body: { error: 'Session not found' },
    };
  }

  await ctx.state.set('sessions', `${sessionId}:history`, { messages: [] });

  await ctx.emit({ topic: 'session.cleared', data: { sessionId } });

  ctx.logger.info('History cleared', { sessionId });

  return {
    status: 200,
    body: { success: true },
  };
};
