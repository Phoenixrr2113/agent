import type { ApiRouteConfig, ApiRouteHandler } from 'motia';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'Health Check',
  path: '/health',
  method: 'GET',
  emits: [],
  flows: ['health'],
};

export const handler: ApiRouteHandler = async (_req, ctx) => {
  ctx.logger.info('Health check requested');

  return {
    status: 200,
    body: { status: 'ok' },
  };
};
