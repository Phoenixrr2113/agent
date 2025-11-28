import type { ModelMessage } from 'ai';
import type { MemoryProvider } from './types.js';
import { logger } from '../logger.js';

export interface MemoryExtractorConfig {
  memoryProvider: MemoryProvider;
  groupId?: string;
}

export interface MemoryExtractor {
  extractFromConversation(messages: ModelMessage[]): Promise<void>;
  waitForPending(): Promise<void>;
}

const QUESTION_PATTERNS = [
  /^(what|who|when|where|why|how|which|whose|whom|is|are|am|do|does|did|can|could|would|should|will|shall|may|might|have|has|had)\b/i,
  /\?$/,
];

const MIN_CONTENT_LENGTH = 10;

function isQuestion(text: string): boolean {
  const trimmed = text.trim();
  return QUESTION_PATTERNS.some(pattern => pattern.test(trimmed));
}

function shouldExtractMessage(message: ModelMessage): boolean {
  if (message.role !== 'user') {
    return false;
  }

  let text = '';
  if (typeof message.content === 'string') {
    text = message.content;
  } else if (Array.isArray(message.content)) {
    text = message.content
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map(part => part.text)
      .join(' ');
  }

  text = text.trim();

  if (text.length < MIN_CONTENT_LENGTH) {
    return false;
  }

  if (isQuestion(text)) {
    return false;
  }

  return true;
}

function extractDialogueText(messages: ModelMessage[]): string {
  const filteredMessages = messages.filter(shouldExtractMessage);

  logger.info('Memory extraction filter results', {
    totalMessages: messages.length,
    filteredToExtract: filteredMessages.length,
    skipped: messages.length - filteredMessages.length,
  });

  if (filteredMessages.length === 0) {
    logger.info('No messages contain extractable information (all questions or AI responses)');
    return '';
  }

  const dialogueParts: string[] = [];

  for (const message of filteredMessages) {
    if (typeof message.content === 'string') {
      dialogueParts.push(`User: ${message.content}`);
    } else if (Array.isArray(message.content)) {
      const textParts = message.content
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map(part => part.text);
      if (textParts.length > 0) {
        dialogueParts.push(`User: ${textParts.join(' ')}`);
      }
    }
  }

  return dialogueParts.join('\n\n');
}

export function createMemoryExtractor(config: MemoryExtractorConfig): MemoryExtractor {
  const { memoryProvider, groupId = 'default' } = config;
  const pendingExtractions: Promise<void>[] = [];

  async function doExtraction(dialogueText: string): Promise<void> {
    if (!dialogueText.trim()) {
      logger.debug('No dialogue text to extract memories from');
      return;
    }

    try {
      logger.info('Extracting memories from conversation...', {
        textLength: dialogueText.length,
      });

      const result = await memoryProvider.add({
        content: dialogueText,
        role: 'user',
        groupId,
        source: 'conversation_extraction',
      });

      logger.info('Memory extraction complete', {
        factIds: result.factIds.length,
        entityIds: result.entityIds.length,
      });
    } catch (error) {
      logger.error('Memory extraction failed', { error: String(error) });
    }
  }

  return {
    async extractFromConversation(messages: ModelMessage[]): Promise<void> {
      const dialogueText = extractDialogueText(messages);
      const extraction = doExtraction(dialogueText);
      pendingExtractions.push(extraction);

      try {
        await extraction;
      } finally {
        const index = pendingExtractions.indexOf(extraction);
        if (index > -1) {
          pendingExtractions.splice(index, 1);
        }
      }
    },

    async waitForPending(): Promise<void> {
      if (pendingExtractions.length > 0) {
        await Promise.all(pendingExtractions);
      }
    },
  };
}

