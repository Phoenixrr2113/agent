import type { EventConfig, EventHandler } from 'motia';
import { z } from 'zod';

export const config: EventConfig = {
  type: 'event',
  name: 'Memory Extraction',
  subscribes: ['memory.extract'],
  input: z.object({
    sessionId: z.string(),
    messages: z.array(z.any()),
  }),
  emits: ['memory.extracted'],
};

export const handler: EventHandler<typeof config> = async (input, ctx) => {
  const { sessionId, messages } = input;

  if (!messages || messages.length === 0) {
    ctx.logger.debug('No messages to extract memory from', { sessionId });
    return;
  }

  ctx.logger.info('Starting memory extraction', {
    sessionId,
    messageCount: messages.length,
  });

  try {
    ctx.logger.info('Memory extraction completed', {
      sessionId,
    });

    await ctx.emit({
      topic: 'memory.extracted',
      data: {
        sessionId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    ctx.logger.error('Memory extraction failed', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
