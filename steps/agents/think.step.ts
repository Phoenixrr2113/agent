import type { EventConfig } from 'motia';
import { streamText, type ModelMessage } from 'ai';
import { z } from 'zod';
import { getActiveTools, getModel, getSystemPrompt } from '../lib/agent-init.js';

const MAX_STEPS = 50;

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

interface ToolCallData {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export const handler = async (input: { sessionId: string; messages: unknown[]; step: number }, ctx: any) => {
  const { sessionId, messages, step } = input;

  if (step >= MAX_STEPS) {
    ctx.logger.warn('Agent loop limit reached', { sessionId, step, maxSteps: MAX_STEPS });
    await ctx.streams.agent.send(
      { groupId: sessionId },
      { type: 'complete', data: { status: 'complete', response: 'Maximum steps reached. Please continue the conversation.', step } }
    );
    await ctx.emit({
      topic: 'agent.response',
      data: { sessionId, response: 'Maximum steps reached. Please continue the conversation.', messages, step },
    });
    return;
  }

  ctx.logger.info('Agent thinking', { sessionId, step, messageCount: messages.length });
  await ctx.streams.agent.send({ groupId: sessionId }, { type: 'thinking', data: { status: 'thinking', step } });

  const tools = await getActiveTools({ sessionId, state: ctx.state });

  const result = streamText({
    model: getModel('standard'),
    system: getSystemPrompt('generic'),
    messages: messages as ModelMessage[],
    tools,
  });

  let fullText = '';
  const toolCalls: ToolCallData[] = [];
  let usage: any;
  let responseMessages: any[] = [];

  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      fullText += part.text;
      await ctx.streams.agent.send(
        { groupId: sessionId },
        { type: 'text_delta', data: { status: 'text_delta', textDelta: part.text, step } }
      );
    }

    if (part.type === 'tool-call') {
      toolCalls.push({
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: 'input' in part ? part.input : (part as any).args,
      });
    }

    if (part.type === 'finish') {
      usage = part.totalUsage;
      responseMessages = (part as any).response?.messages || [];
    }
  }

  const formattedUsage = usage ? {
    inputTokens: usage.promptTokens,
    outputTokens: usage.completionTokens,
    totalTokens: usage.promptTokens + usage.completionTokens,
  } : undefined;

  ctx.logger.info('Agent thought complete', {
    sessionId,
    step,
    hasText: !!fullText,
    toolCallCount: toolCalls.length,
    usage: formattedUsage,
  });

  await ctx.emit({
    topic: 'log.thought',
    data: {
      sessionId,
      type: 'thought',
      data: { step, thought: fullText, toolCallCount: toolCalls.length },
    },
  });

  if (toolCalls.length > 0) {
    const taskComplete = toolCalls.find(tc => tc.toolName === 'task_complete');
    if (taskComplete) {
      const summary = (taskComplete.input as Record<string, unknown>)?.summary as string || 'Task completed.';
      ctx.logger.info('Task marked complete by agent', { sessionId, step, summary });
      await ctx.streams.agent.send(
        { groupId: sessionId },
        { type: 'complete', data: { status: 'complete', response: summary, step } }
      );
      await ctx.emit({
        topic: 'agent.response',
        data: { sessionId, response: summary, messages: [...messages, ...responseMessages], step },
      });
      return;
    }

    const askUser = toolCalls.find(tc => tc.toolName === 'ask_user');
    if (askUser) {
      const question = (askUser.input as Record<string, unknown>)?.question as string || 'What would you like to do?';
      ctx.logger.info('Agent asking user', { sessionId, step, question });
      await ctx.streams.agent.send(
        { groupId: sessionId },
        { type: 'complete', data: { status: 'awaiting_input', response: question, step } }
      );
      await ctx.emit({
        topic: 'agent.response',
        data: { sessionId, response: question, messages: [...messages, ...responseMessages], step },
      });
      return;
    }

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
          messages: [...messages, ...responseMessages],
          step: step + 1,
        },
      });
    }
  } else {
    await ctx.streams.agent.send(
      { groupId: sessionId },
      { type: 'responding', data: { status: 'responding', thought: fullText, step, usage: formattedUsage } }
    );

    await ctx.emit({
      topic: 'agent.response',
      data: {
        sessionId,
        response: fullText,
        messages: [...messages, ...responseMessages],
        step,
      },
    });
  }
};


