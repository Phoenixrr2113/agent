import type { ApiRouteConfig, ApiRouteHandler } from 'motia';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Delete Session',
  path: '/sessions/:sessionId',
  method: 'DELETE',
  emits: ['session.deleted'],
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

  await ctx.state.delete('sessions', sessionId);
  await ctx.state.delete('sessions', `${sessionId}:history`);
  await ctx.state.delete('sessions', `${sessionId}:response`);

  await ctx.emit({ topic: 'session.deleted', data: { sessionId } });

  ctx.logger.info('Session deleted', { sessionId });

  return {
    status: 200,
    body: { success: true },
  };
};
