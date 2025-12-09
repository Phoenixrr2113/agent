import type { EventConfig } from 'motia';
import { z } from 'zod';

export const config: EventConfig = {
  type: 'event',
  name: 'Agent Respond',
  subscribes: ['agent.response'],
  input: z.object({
    sessionId: z.string(),
    response: z.string(),
    messages: z.array(z.any()),
    step: z.number(),
  }),
  emits: [
    { topic: 'agent.complete', label: 'Agent Complete' },
    { topic: 'memory.extract', label: 'Memory Extract' },
    { topic: 'log.response', label: 'Log Response' },
  ],
  flows: ['agent-loop'],
};

export const handler = async (
  input: { sessionId: string; response: string; messages: unknown[]; step: number },
  ctx: any
) => {
  const { sessionId, response, messages, step } = input;

  ctx.logger.info('Agent responding', { sessionId, step, responseLength: response.length });

  await ctx.emit({
    topic: 'log.response',
    data: {
      sessionId,
      type: 'response',
      data: { step, responseLength: response.length },
    },
  });

  await ctx.streams.agent.send(
    { groupId: sessionId },
    { type: 'complete', data: { status: 'complete', response, step } }
  );

  await ctx.state.set('sessions', `${sessionId}:response`, {
    response,
    messages,
    completedAt: new Date().toISOString(),
    step,
  });

  await ctx.state.set('sessions', `${sessionId}:history`, { messages });

  await ctx.emit({
    topic: 'agent.complete',
    data: {
      sessionId,
      response,
      step,
    },
  });

  await ctx.emit({
    topic: 'memory.extract',
    data: {
      sessionId,
      messages,
    },
  });

  ctx.logger.info('Agent complete', { sessionId, step });
};

