import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentHttpClient } from './http-client';
import { ApiClientError } from './errors';

describe('AgentHttpClient', () => {
  let client: AgentHttpClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    client = new AgentHttpClient({ baseUrl: 'http://localhost:3000' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('trims trailing slash from baseUrl', () => {
      const c = new AgentHttpClient({ baseUrl: 'http://localhost:3000/' });
      expect(c['baseUrl']).toBe('http://localhost:3000');
    });

    it('uses default timeout of 120000ms', () => {
      expect(client['timeout']).toBe(120000);
    });

    it('accepts custom timeout', () => {
      const c = new AgentHttpClient({ baseUrl: 'http://localhost:3000', timeout: 5000 });
      expect(c['timeout']).toBe(5000);
    });

    it('sets apiKey when provided', () => {
      const c = new AgentHttpClient({ baseUrl: 'http://localhost:3000', apiKey: 'test-key' });
      expect(c['apiKey']).toBe('test-key');
    });
  });

  describe('health', () => {
    it('makes GET request to /health', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      });

      const result = await client.health();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/health',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('createSession', () => {
    it('makes POST request to /sessions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'sess-123' }),
      });

      const result = await client.createSession();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/sessions',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result).toEqual({ sessionId: 'sess-123' });
    });
  });

  describe('chat', () => {
    it('makes POST request with message body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'Hello!', completed: true }),
      });

      const result = await client.chat('sess-123', 'Hi');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/sessions/sess-123/chat',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message: 'Hi' }),
        })
      );
      expect(result).toEqual({ text: 'Hello!', completed: true });
    });
  });

  describe('error handling', () => {
    it('throws Error with status code on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      await expect(client.health()).rejects.toThrow('HTTP 404: Not Found');
    });

    it('calls onError callback on error', async () => {
      const onError = vi.fn();
      const c = new AgentHttpClient({
        baseUrl: 'http://localhost:3000',
        onError,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error'),
      });

      await expect(c.health()).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('headers', () => {
    it('includes Content-Type header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await client.health();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      );
    });

    it('includes Authorization header when apiKey is set', async () => {
      const c = new AgentHttpClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'my-api-key',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await c.health();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-api-key',
          }),
        })
      );
    });
  });

  describe('chatStreamWithCallbacks', () => {
    it('calls appropriate callbacks for stream events', async () => {
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: text:delta\ndata: {"delta":"Hello"}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('event: complete\ndata: {"text":"Hello","completed":true}\n\n'),
          })
          .mockResolvedValueOnce({ done: true }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const callbacks = {
        onTextDelta: vi.fn(),
        onComplete: vi.fn(),
      };

      await client.chatStreamWithCallbacks('sess-123', 'Hi', callbacks);

      expect(callbacks.onTextDelta).toHaveBeenCalledWith({ delta: 'Hello' });
      expect(callbacks.onComplete).toHaveBeenCalledWith({
        text: 'Hello',
        completed: true,
      });
    });
  });
});

describe('ApiClientError', () => {
  it('creates error with status and message', () => {
    const error = new ApiClientError('Not Found', 404);
    expect(error.message).toBe('Not Found');
    expect(error.status).toBe(404);
    expect(error.name).toBe('ApiClientError');
  });

  it('fromResponse creates error from status and body', () => {
    const error = ApiClientError.fromResponse(500, 'Internal Server Error');
    expect(error.message).toBe('HTTP 500: Internal Server Error');
    expect(error.status).toBe(500);
    expect(error.responseBody).toBe('Internal Server Error');
  });

  it('includes optional code and responseBody', () => {
    const error = new ApiClientError('Error', 400, 'INVALID_REQUEST', '{"error": "bad"}');
    expect(error.code).toBe('INVALID_REQUEST');
    expect(error.responseBody).toBe('{"error": "bad"}');
  });
});
