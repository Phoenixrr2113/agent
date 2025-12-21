import { createMiddleware } from 'hono/factory';

import type { ApiKeyStorage } from './types.js';

export function createAuthMiddleware(storage: ApiKeyStorage) {
  return createMiddleware<{ Variables: { userId: string } }>(async (c, next) => {
    const auth = c.req.header('Authorization');
    
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: 'API key required. Use Authorization: Bearer <key>' }, 401);
    }

    const key = auth.slice(7);
    const keyHash = await storage.validate(key);

    if (!keyHash) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    c.set('userId', keyHash);
    return next();
  });
}
