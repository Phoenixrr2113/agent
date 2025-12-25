import type { ConnectionState, WebSocketMessage } from './types';
import { WebSocketError } from './errors';

export interface WebSocketClientConfig {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: ConnectionState) => void;
}

export class AgentWebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketClientConfig>;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private state: ConnectionState = 'disconnected';
  private messageQueue: WebSocketMessage[] = [];

  constructor(config: WebSocketClientConfig) {
    this.config = {
      url: config.url,
      reconnect: config.reconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 3000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      onConnect: config.onConnect ?? (() => {}),
      onDisconnect: config.onDisconnect ?? (() => {}),
      onMessage: config.onMessage ?? (() => {}),
      onError: config.onError ?? (() => {}),
      onStateChange: config.onStateChange ?? (() => {}),
    };
  }

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.config.onStateChange(newState);
    }
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.setState('connecting');

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        this.setState('connected');
        this.reconnectAttempts = 0;
        this.config.onConnect();
        this.flushMessageQueue();
      };

      this.ws.onclose = () => {
        this.setState('disconnected');
        this.config.onDisconnect();
        this.attemptReconnect();
      };

      this.ws.onerror = () => {
        this.setState('error');
        this.config.onError(WebSocketError.connectionFailed());
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as WebSocketMessage;
          this.config.onMessage(message);
        } catch (e) {
          this.config.onError(WebSocketError.messageParseFailed(e));
        }
      };
    } catch (error) {
      this.setState('error');
      this.config.onError(error instanceof Error ? error : new Error(String(error)));
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (!this.config.reconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.config.onError(WebSocketError.maxReconnectAttemptsReached(this.config.maxReconnectAttempts));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendImmediate(message);
      }
    }
  }

  private sendImmediate(message: WebSocketMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  send(message: WebSocketMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return this.sendImmediate(message);
    }

    this.messageQueue.push(message);
    return false;
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.config.reconnect = false;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
  }

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }
}
