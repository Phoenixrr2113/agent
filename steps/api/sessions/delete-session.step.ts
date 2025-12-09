import type { ApiRouteConfig, ApiRouteHandler } from 'motia';
import { deleteSession, hasSession } from '../../lib/session-store.js';

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

  if (!hasSession(sessionId)) {
    return {
      status: 404,
      body: { error: 'Session not found' },
    };
  }

  deleteSession(sessionId);
  await ctx.state.delete(sessionId);

  await ctx.emit({ topic: 'session.deleted', data: { sessionId } });

  ctx.logger.info('Session deleted', { sessionId });

  return {
    status: 200,
    body: { success: true },
  };
};
