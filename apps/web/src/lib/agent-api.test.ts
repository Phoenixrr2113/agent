import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSession,
  deleteSession,
  getHistory,
  clearHistory,
  sendMessage,
} from './agent-api';

describe('agent-api', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('createSession', () => {
    it('should create a session successfully', async () => {
      const mockSessionId = 'test-session-123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionId: mockSessionId }),
      });

      const session = await createSession();

      expect(session.sessionId).toBe(mockSessionId);
      expect(session.createdAt).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should throw on failed session creation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(createSession()).rejects.toThrow('Failed to create session');
    });
  });

  describe('deleteSession', () => {
    it('should delete a session successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await deleteSession('test-session-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/test-session-123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('getHistory', () => {
    it('should retrieve message history', async () => {
      const mockMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: mockMessages }),
      });

      const messages = await getHistory('test-session-123');

      expect(messages).toEqual(mockMessages);
    });

    it('should return empty array when no messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const messages = await getHistory('test-session-123');

      expect(messages).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    it('should clear history successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await clearHistory('test-session-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/test-session-123/clear'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('sendMessage', () => {
    it('should send a message and return response', async () => {
      const mockResponse = {
        sessionId: 'test-session-123',
        traceId: 'trace-456',
        status: 'processing',
        message: 'Request accepted',
        streamUrl: '/streams/agent/test-session-123',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const response = await sendMessage('test-session-123', 'Hello');

      expect(response).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/test-session-123/chat'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Hello' }),
        })
      );
    });
  });
});

