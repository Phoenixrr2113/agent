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

function extractDialogueText(messages: ModelMessage[]): string {
  const dialogueParts: string[] = [];

  for (const message of messages) {
    if (message.role === 'user') {
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
    } else if (message.role === 'assistant') {
      if (typeof message.content === 'string') {
        dialogueParts.push(`Assistant: ${message.content}`);
      } else if (Array.isArray(message.content)) {
        const textParts = message.content
          .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
          .map(part => part.text);
        if (textParts.length > 0) {
          dialogueParts.push(`Assistant: ${textParts.join(' ')}`);
        }
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

