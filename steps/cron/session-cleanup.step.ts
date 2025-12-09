import type { CronConfig, CronHandler } from 'motia';

export const config: CronConfig = {
  type: 'cron',
  name: 'Session Cleanup',
  cron: '0 */6 * * *',
  emits: ['sessions.cleaned'],
};

export const handler: CronHandler = async (ctx) => {
  const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  let cleanedCount = 0;

  ctx.logger.info('Starting session cleanup');

  try {
    const sessionGroup = await ctx.state.getGroup('sessions');
    const sessions = sessionGroup ? Object.entries(sessionGroup) : [];

    for (const [sessionId, sessionData] of sessions) {
      const session = sessionData as { createdAt: string };
      const createdAt = new Date(session.createdAt).getTime();
      const age = now - createdAt;

      if (age > MAX_SESSION_AGE_MS) {
        await ctx.state.delete(sessionId);
        cleanedCount++;
        ctx.logger.debug('Cleaned up session', { sessionId, ageHours: age / 3600000 });
      }
    }

    ctx.logger.info('Session cleanup completed', { cleanedCount });

    await ctx.emit({
      topic: 'sessions.cleaned',
      data: {
        cleanedCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    ctx.logger.error('Session cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
