import type { ApiRouteConfig, ApiRouteHandler } from 'motia';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Get History',
  path: '/sessions/:sessionId/history',
  method: 'GET',
  emits: [],
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

  const historyData = await ctx.state.get<{ messages: any[] }>('sessions', `${sessionId}:history`);

  ctx.logger.info('History retrieved', { sessionId });

  return {
    status: 200,
    body: { messages: historyData?.messages || [] },
  };
};
