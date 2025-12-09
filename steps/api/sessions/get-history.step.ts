import type { ApiRouteConfig, ApiRouteHandler } from 'motia';
import { getSession } from '../../lib/session-store.js';

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

  const session = getSession(sessionId);

  if (!session) {
    return {
      status: 404,
      body: { error: 'Session not found' },
    };
  }

  ctx.logger.info('History retrieved', { sessionId });

  return {
    status: 200,
    body: { messages: session.getHistory() },
  };
};
