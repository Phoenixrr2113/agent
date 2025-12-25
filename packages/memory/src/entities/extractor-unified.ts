import { logger } from '@agent/shared';
import type { ModelMessage } from 'ai';

import { createGraphitiMemory } from './extractor-simple.js';
import {
  createProfileStorage,
  createProfileExtractor,
  createProfileManager,
  type ProfileStorageAdapter,
  type ProfileManager,
} from '../profiles/index.js';

export interface UnifiedMemoryExtractor {
  extractFromConversation(messages: ModelMessage[], userId?: string): Promise<void>;
  waitForPending(): Promise<void>;
  getProfileStorage(): ProfileStorageAdapter;
  getProfileManager(): ProfileManager;
}

export function createUnifiedMemoryExtractor(
  dbPath: string = './memory.db',
  graphitiGroupId: string = 'default'
): UnifiedMemoryExtractor {
  const graphiti = createGraphitiMemory();
  const profileStorage = createProfileStorage(dbPath);
  const profileManager = createProfileManager(profileStorage);
  const profileExtractor = createProfileExtractor(profileStorage);

  let pendingExtractions: Promise<void>[] = [];
  let lastProcessedIndex = -1;

  return {
    async extractFromConversation(messages: ModelMessage[], userId?: string): Promise<void> {
      const newMessages = messages.slice(lastProcessedIndex + 1);
      if (newMessages.length === 0) return;

      const extraction = (async () => {
        const startTime = performance.now();

        try {
          await graphiti.addMessages(messages, graphitiGroupId);

          if (userId) {
            let profile = await profileStorage.getProfile(userId);
            if (!profile) {
              profile = await profileStorage.createProfile(userId);
            }

            const formattedMessages = newMessages
              .filter(m => m.role === 'user' || m.role === 'assistant')
              .map(m => ({
                role: m.role,
                content: m.content,
              }));

            if (formattedMessages.length > 0) {
              const update = await profileExtractor.extractFromConversation(
                formattedMessages,
                userId
              );

              const hasUpdates =
                update.additions.length > 0 ||
                update.updates.length > 0 ||
                update.invalidations.length > 0;

              if (hasUpdates) {
                await profileStorage.updateProfile(userId, update);
                const duration = performance.now() - startTime;
                logger.info('⏱️  [unified-extractor] Profile updated', {
                  userId,
                  durationMs: duration.toFixed(2),
                  additions: update.additions.length,
                  updates: update.updates.length,
                });
              }
            }
          }

          lastProcessedIndex = messages.length - 1;
        } catch (error) {
          const duration = performance.now() - startTime;
          logger.error('⏱️  [unified-extractor] Extraction failed', {
            durationMs: duration.toFixed(2),
            error: String(error),
          });
        }
      })();

      pendingExtractions.push(extraction);

      extraction.finally(() => {
        pendingExtractions = pendingExtractions.filter(p => p !== extraction);
      });
    },

    async waitForPending(): Promise<void> {
      await Promise.all(pendingExtractions);
    },

    getProfileStorage(): ProfileStorageAdapter {
      return profileStorage;
    },

    getProfileManager(): ProfileManager {
      return profileManager;
    },
  };
}
