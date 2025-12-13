import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createMemoryExtractor } from './extractor.js';

import type { MemoryProvider } from './types.js';
import type { ModelMessage } from "../../types";

describe('Memory Extractor', () => {
  let mockMemoryProvider: MemoryProvider;
  let addSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addSpy = vi.fn().mockResolvedValue({ factIds: [], entityIds: [] });
    mockMemoryProvider = {
      add: addSpy,
      search: vi.fn(),
      getEntity: vi.fn(),
      getFact: vi.fn(),
      getRelation: vi.fn(),
      searchEntities: vi.fn(),
      searchFacts: vi.fn(),
      searchRelations: vi.fn(),
    } as any;
  });

  describe('Incremental Extraction', () => {
    it('should extract from all messages on first call', async () => {
      const extractor = createMemoryExtractor({
        memoryProvider: mockMemoryProvider,
        groupId: 'test-group',
      });

      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello, my name is Alice' },
        { role: 'assistant', content: 'Nice to meet you, Alice!' },
      ];

      await extractor.extractFromConversation(messages);
      await extractor.waitForPending();

      expect(addSpy).toHaveBeenCalledTimes(1);
      const callArgs = addSpy.mock.calls[0][0];
      expect(callArgs.content).toContain('Alice');
      expect(callArgs.lastProcessedMessageIndex).toBe(1);
    });

    it('should only extract from new messages on subsequent calls', async () => {
      const extractor = createMemoryExtractor({
        memoryProvider: mockMemoryProvider,
        groupId: 'test-group',
      });

      const messages1: ModelMessage[] = [
        { role: 'user', content: 'My favorite color is blue' },
        { role: 'assistant', content: 'Blue is a great color!' },
      ];

      await extractor.extractFromConversation(messages1);
      await extractor.waitForPending();

      expect(addSpy).toHaveBeenCalledTimes(1);
      const firstCall = addSpy.mock.calls[0][0];
      expect(firstCall.content).toContain('blue');
      expect(firstCall.lastProcessedMessageIndex).toBe(1);

      const messages2: ModelMessage[] = [
        ...messages1,
        { role: 'user', content: 'I also like red' },
        { role: 'assistant', content: 'Red is nice too!' },
      ];

      await extractor.extractFromConversation(messages2);
      await extractor.waitForPending();

      expect(addSpy).toHaveBeenCalledTimes(2);
      const secondCall = addSpy.mock.calls[1][0];
      expect(secondCall.content).toContain('red');
      expect(secondCall.content).not.toContain('blue');
      expect(secondCall.lastProcessedMessageIndex).toBe(3);
    });

    it('should skip extraction when no new messages', async () => {
      const extractor = createMemoryExtractor({
        memoryProvider: mockMemoryProvider,
        groupId: 'test-group',
      });

      const messages: ModelMessage[] = [
        { role: 'user', content: 'Test message' },
        { role: 'assistant', content: 'Response' },
      ];

      await extractor.extractFromConversation(messages);
      await extractor.waitForPending();

      expect(addSpy).toHaveBeenCalledTimes(1);

      await extractor.extractFromConversation(messages);
      await extractor.waitForPending();

      expect(addSpy).toHaveBeenCalledTimes(1);
    });

    it('should filter out system and tool messages', async () => {
      const extractor = createMemoryExtractor({
        memoryProvider: mockMemoryProvider,
        groupId: 'test-group',
      });

      const messages: ModelMessage[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant response', toolInvocations: [] },
        { role: 'tool', content: 'Tool result' },
      ];

      await extractor.extractFromConversation(messages);
      await extractor.waitForPending();

      const callArgs = addSpy.mock.calls[0][0];
      expect(callArgs.content).toContain('User message');
      expect(callArgs.content).toContain('Assistant response');
      expect(callArgs.content).not.toContain('System prompt');
      expect(callArgs.content).not.toContain('Tool result');
    });

    it('should handle empty message arrays', async () => {
      const extractor = createMemoryExtractor({
        memoryProvider: mockMemoryProvider,
        groupId: 'test-group',
      });

      await extractor.extractFromConversation([]);
      await extractor.waitForPending();

      expect(addSpy).not.toHaveBeenCalled();
    });

    it('should track multiple pending extractions', async () => {
      const extractor = createMemoryExtractor({
        memoryProvider: mockMemoryProvider,
        groupId: 'test-group',
      });

      const messages1: ModelMessage[] = [
        { role: 'user', content: 'First message' },
      ];
      const messages2: ModelMessage[] = [
        ...messages1,
        { role: 'user', content: 'Second message' },
      ];

      const promise1 = extractor.extractFromConversation(messages1);
      const promise2 = extractor.extractFromConversation(messages2);

      await Promise.all([promise1, promise2]);
      await extractor.waitForPending();

      expect(addSpy).toHaveBeenCalledTimes(2);
    });
  });
});

