import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentWebSocketClient } from './websocket-client';
import { WebSocketError } from './errors';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((this: WebSocket, ev: Event) => unknown) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null;
  onerror: ((this: WebSocket, ev: Event) => unknown) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.call(this as unknown as WebSocket, new Event('open'));
    }, 0);
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.call(this as unknown as WebSocket, { type: 'close' } as CloseEvent);
  });
}

describe('AgentWebSocketClient', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('sets default config values', () => {
      const client = new AgentWebSocketClient({ url: 'ws://localhost:3000' });
      expect(client['config'].reconnect).toBe(true);
      expect(client['config'].reconnectInterval).toBe(3000);
      expect(client['config'].maxReconnectAttempts).toBe(5);
    });

    it('accepts custom config values', () => {
      const client = new AgentWebSocketClient({
        url: 'ws://localhost:3000',
        reconnect: false,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
      });
      expect(client['config'].reconnect).toBe(false);
      expect(client['config'].reconnectInterval).toBe(5000);
      expect(client['config'].maxReconnectAttempts).toBe(10);
    });
  });

  describe('connect', () => {
    it('sets state to connecting', () => {
      const onStateChange = vi.fn();
      const client = new AgentWebSocketClient({
        url: 'ws://localhost:3000',
        onStateChange,
      });

      client.connect();
      expect(onStateChange).toHaveBeenCalledWith('connecting');
    });

    it('sets state to connected on open', async () => {
      const onStateChange = vi.fn();
      const onConnect = vi.fn();
      const client = new AgentWebSocketClient({
        url: 'ws://localhost:3000',
        onStateChange,
        onConnect,
      });

      client.connect();
      await new Promise((r) => setTimeout(r, 10));

      expect(onStateChange).toHaveBeenCalledWith('connected');
      expect(onConnect).toHaveBeenCalled();
    });

    it('does not reconnect if already connected', async () => {
      const client = new AgentWebSocketClient({ url: 'ws://localhost:3000' });
      client.connect();
      await new Promise((r) => setTimeout(r, 10));

      const ws = client['ws'];
      client.connect();
      expect(client['ws']).toBe(ws);
    });
  });

  describe('send', () => {
    it('sends message when connected', async () => {
      const client = new AgentWebSocketClient({ url: 'ws://localhost:3000' });
      client.connect();
      await new Promise((r) => setTimeout(r, 10));

      const result = client.send({ type: 'test', data: 'hello' });
      expect(result).toBe(true);
      expect(client['ws']?.send).toHaveBeenCalledWith('{"type":"test","data":"hello"}');
    });

    it('queues message when not connected', () => {
      const client = new AgentWebSocketClient({ url: 'ws://localhost:3000' });
      const result = client.send({ type: 'test' });
      expect(result).toBe(false);
      expect(client['messageQueue']).toHaveLength(1);
    });

    it('flushes queue on connect', async () => {
      const client = new AgentWebSocketClient({ url: 'ws://localhost:3000' });
      client.send({ type: 'queued' });

      client.connect();
      await new Promise((r) => setTimeout(r, 10));

      expect(client['ws']?.send).toHaveBeenCalledWith('{"type":"queued"}');
      expect(client['messageQueue']).toHaveLength(0);
    });
  });

  describe('disconnect', () => {
    it('closes websocket and sets state to disconnected', async () => {
      const onStateChange = vi.fn();
      const client = new AgentWebSocketClient({
        url: 'ws://localhost:3000',
        onStateChange,
      });

      client.connect();
      await new Promise((r) => setTimeout(r, 10));

      client.disconnect();
      expect(client['ws']).toBeNull();
      expect(onStateChange).toHaveBeenCalledWith('disconnected');
    });

    it('disables reconnect on disconnect', async () => {
      const client = new AgentWebSocketClient({ url: 'ws://localhost:3000' });
      client.connect();
      await new Promise((r) => setTimeout(r, 10));

      client.disconnect();
      expect(client['config'].reconnect).toBe(false);
    });
  });

  describe('message handling', () => {
    it('parses JSON messages and calls onMessage', async () => {
      const onMessage = vi.fn();
      const client = new AgentWebSocketClient({
        url: 'ws://localhost:3000',
        onMessage,
      });

      client.connect();
      await new Promise((r) => setTimeout(r, 10));

      (client['ws'] as unknown as MockWebSocket).onmessage?.call(
        client['ws'] as unknown as WebSocket,
        new MessageEvent('message', { data: '{"type":"greeting","text":"hello"}' })
      );
      expect(onMessage).toHaveBeenCalledWith({ type: 'greeting', text: 'hello' });
    });

    it('calls onError for invalid JSON', async () => {
      const onError = vi.fn();
      const client = new AgentWebSocketClient({
        url: 'ws://localhost:3000',
        onError,
      });

      client.connect();
      await new Promise((r) => setTimeout(r, 10));

      (client['ws'] as unknown as MockWebSocket).onmessage?.call(
        client['ws'] as unknown as WebSocket,
        new MessageEvent('message', { data: 'invalid json' })
      );
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('getState and isConnected', () => {
    it('returns correct state', async () => {
      const client = new AgentWebSocketClient({ url: 'ws://localhost:3000' });
      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);

      client.connect();
      await new Promise((r) => setTimeout(r, 10));

      expect(client.getState()).toBe('connected');
      expect(client.isConnected()).toBe(true);
    });
  });
});

describe('WebSocketError', () => {
  it('creates error with message and code', () => {
    const error = new WebSocketError('Connection failed', 'CONNECTION_FAILED');
    expect(error.message).toBe('Connection failed');
    expect(error.code).toBe('CONNECTION_FAILED');
    expect(error.name).toBe('WebSocketError');
  });

  it('connectionFailed creates appropriate error', () => {
    const error = WebSocketError.connectionFailed();
    expect(error.message).toBe('WebSocket connection failed');
    expect(error.code).toBe('CONNECTION_FAILED');
  });

  it('messageParseFailed creates error with original error message', () => {
    const originalError = new Error('Unexpected token');
    const error = WebSocketError.messageParseFailed(originalError);
    expect(error.message).toContain('Unexpected token');
    expect(error.code).toBe('PARSE_ERROR');
  });

  it('maxReconnectAttemptsReached includes attempt count', () => {
    const error = WebSocketError.maxReconnectAttemptsReached(5);
    expect(error.message).toContain('5');
    expect(error.code).toBe('MAX_RECONNECT_ATTEMPTS');
  });
});
