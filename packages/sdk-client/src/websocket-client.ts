// WebSocket client for streaming

import { WebSocketError } from './errors';
import type { StreamingChatCallbacks, ChatMessage } from './types';

export interface WebSocketClientConfig {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
}

export class AgentWebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketClientConfig;

  constructor(config: WebSocketClientConfig) {
    this.config = config;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);
        this.ws.onopen = () => resolve();
        this.ws.onerror = (event) => reject(new WebSocketError('Connection failed'));
      } catch (error) {
        reject(new WebSocketError('Failed to create WebSocket'));
      }
    });
  }

  send(message: ChatMessage, callbacks: StreamingChatCallbacks): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new WebSocketError('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(message));
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'text-delta' && callbacks.onText) {
          callbacks.onText(data.text);
        } else if (data.type === 'complete' && callbacks.onComplete) {
          callbacks.onComplete();
        }
      } catch (e) {
        callbacks.onError?.(new Error('Failed to parse message'));
      }
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
