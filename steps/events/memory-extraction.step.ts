import type { EventConfig } from 'motia';
import { z } from 'zod';
import { getMemoryProvider } from '@agent/core';

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

function extractTextFromMessage(message: { content: string | Array<{ type: string; text?: string }> }): string | null {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    const textParts = message.content
      .filter((part) => part.type === 'text' && part.text)
      .map((part) => part.text as string);
    if (textParts.length > 0) {
      return textParts.join(' ');
    }
  }
  return null;
}

function extractDialogueText(messages: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }>): string {
  const relevantMessages = messages.filter(
    (msg) => msg.role === 'user' || msg.role === 'assistant'
  );

  if (relevantMessages.length === 0) {
    return '';
  }

  const dialogueParts: string[] = [];

  for (const message of relevantMessages) {
    const text = extractTextFromMessage(message);
    if (text) {
      const prefix = message.role === 'user' ? 'User' : 'Assistant';
      dialogueParts.push(`${prefix}: ${text}`);
    }
  }

  return dialogueParts.join('\n\n');
}

export const handler = async (
  input: { sessionId: string; messages: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }> },
  ctx: { logger: { debug: (msg: string, data?: object) => void; info: (msg: string, data?: object) => void; error: (msg: string, data?: object) => void }; emit: (event: { topic: string; data: object }) => Promise<void> }
) => {
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
    const dialogueText = extractDialogueText(messages);

    if (!dialogueText.trim()) {
      ctx.logger.debug('No dialogue text to extract', { sessionId });
      return;
    }

    const memoryProvider = await getMemoryProvider();
    const result = await memoryProvider.add({
      content: dialogueText,
      role: 'user',
      groupId: sessionId,
      source: 'conversation_extraction',
    });

    ctx.logger.info('Memory extraction completed', {
      sessionId,
      factsExtracted: result.factIds.length,
      entitiesExtracted: result.entityIds.length,
    });

    await ctx.emit({
      topic: 'memory.extracted',
      data: {
        sessionId,
        timestamp: new Date().toISOString(),
        factsExtracted: result.factIds.length,
        entitiesExtracted: result.entityIds.length,
      },
    });
  } catch (error) {
    ctx.logger.error('Memory extraction failed', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
