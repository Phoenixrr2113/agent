import type { EventConfig } from 'motia';
import { z } from 'zod';
import { getActiveTools } from '../lib/agent-init.js';

export const config: EventConfig = {
  type: 'event',
  name: 'Tool Execute',
  subscribes: ['agent.tool_call'],
  input: z.object({
    sessionId: z.string(),
    toolCallId: z.string(),
    toolName: z.string(),
    toolArgs: z.any(),
    messages: z.array(z.any()),
    step: z.number(),
  }),
  emits: [
    { topic: 'agent.tool_result', label: 'Tool Result' },
    { topic: 'log.tool', label: 'Log Tool' },
  ],
  flows: ['agent-loop'],
};

export const handler = async (
  input: { sessionId: string; toolCallId: string; toolName: string; toolArgs: unknown; messages: unknown[]; step: number },
  ctx: any
) => {
  const { sessionId, toolCallId: id, toolName: name, toolArgs: args, messages, step } = input;

  ctx.logger.info('Executing tool', { sessionId, tool: name, step });

  const tools = await getActiveTools({ sessionId, state: ctx.state });
  const tool = tools[name];

  if (!tool) {
    ctx.logger.error('Tool not found', { sessionId, tool: name });

    await ctx.emit({
      topic: 'agent.tool_result',
      data: {
        sessionId,
        messages: [
          ...messages,
          {
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId: id, toolName: name, output: { type: 'error-text', value: `Tool "${name}" not found` } }],
          },
        ],
        step,
      },
    });
    return;
  }

  const startTime = performance.now();
  let result: string;

  try {
    result = await tool.execute(args);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    ctx.logger.error('Tool execution failed', { sessionId, tool: name, error: errorMessage });
    result = `Error executing tool: ${errorMessage}`;
  }

  const durationMs = performance.now() - startTime;

  ctx.logger.info('Tool executed', { sessionId, tool: name, durationMs: durationMs.toFixed(2) });

  await ctx.emit({
    topic: 'log.tool',
    data: {
      sessionId,
      type: 'tool_result',
      data: { toolName: name, durationMs, step },
    },
  });

  await ctx.streams.agent.send(
    { groupId: sessionId },
    { status: 'tool_result', toolName: name, toolOutput: result, step }
  );

  await ctx.emit({
    topic: 'agent.tool_result',
    data: {
      sessionId,
      messages: [
        ...messages,
        {
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: id, toolName: name, output: { type: 'text', value: result } }],
        },
      ],
      step,
    },
  });
};

