import type { EventConfig } from 'motia';
import { generateText, type ModelMessage } from 'ai';
import { z } from 'zod';
import { getActiveTools, getModel, getSystemPrompt } from '../lib/agent-init.js';

export const config: EventConfig = {
  type: 'event',
  name: 'Agent Think',
  subscribes: ['agent.think', 'agent.tool_result'],
  input: z.object({
    sessionId: z.string(),
    messages: z.array(z.any()),
    step: z.number().default(0),
  }),
  emits: [
    { topic: 'agent.tool_call', label: 'Tool Call' },
    { topic: 'agent.response', label: 'Final Response' },
    { topic: 'log.thought', label: 'Log Thought' },
  ],
  flows: ['agent-loop'],
};

export const handler = async (input: { sessionId: string; messages: unknown[]; step: number }, ctx: any) => {
  const { sessionId, messages, step } = input;

  ctx.logger.info('Agent thinking', { sessionId, step, messageCount: messages.length });

  await ctx.streams.agent.send({ groupId: sessionId }, { type: 'thinking', data: { status: 'thinking', step } });

  const tools = await getActiveTools({ sessionId, state: ctx.state });

  const response = await generateText({
    model: getModel('standard'),
    system: getSystemPrompt('generic'),
    messages: messages as ModelMessage[],
    tools,
  });

  const text = response.text || '';
  const toolCalls = response.toolCalls || [];

  ctx.logger.info('Agent thought complete', {
    sessionId,
    step,
    hasText: !!text,
    toolCallCount: toolCalls.length,
  });

  await ctx.emit({
    topic: 'log.thought',
    data: {
      sessionId,
      type: 'thought',
      data: { step, thought: text, toolCallCount: toolCalls.length },
    },
  });

  if (toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      await ctx.streams.agent.send(
        { groupId: sessionId },
        { type: 'tool_calling', data: { status: 'tool_calling', toolName: toolCall.toolName, toolInput: toolCall.input, step: step + 1 } }
      );

      await ctx.emit({
        topic: 'agent.tool_call',
        data: {
          sessionId,
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          toolArgs: toolCall.input,
          messages: [...messages, ...response.response.messages],
          step: step + 1,
        },
      });
    }
  } else {
    await ctx.streams.agent.send(
      { groupId: sessionId },
      { type: 'responding', data: { status: 'responding', thought: text, step } }
    );

    await ctx.emit({
      topic: 'agent.response',
      data: {
        sessionId,
        response: text,
        messages: [...messages, ...response.response.messages],
        step,
      },
    });
  }
};

