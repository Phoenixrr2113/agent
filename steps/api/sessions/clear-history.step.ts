import type { ApiRouteConfig, ApiRouteHandler } from 'motia';
import { getSession } from '../../lib/session-store.js';

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

  const session = getSession(sessionId);

  if (!session) {
    return {
      status: 404,
      body: { error: 'Session not found' },
    };
  }

  session.clearHistory();

  await ctx.emit({ topic: 'session.cleared', data: { sessionId } });

  ctx.logger.info('History cleared', { sessionId });

  return {
    status: 200,
    body: { success: true },
  };
};
