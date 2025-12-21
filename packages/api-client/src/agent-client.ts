import { AgentHttpClient } from './http-client';
import { AgentWebSocketClient } from './websocket-client';
import type {
  AgentClientConfig,
  ChatMessage,
  ChatResponse,
  ConnectionState,
  WebSocketMessage,
  StreamingChatCallbacks,
} from './types';

export interface AgentClientOptions extends AgentClientConfig {
  enableWebSocket?: boolean;
  webSocketUrl?: string;
}

export class AgentClient {
  private http: AgentHttpClient;
  private ws: AgentWebSocketClient | null = null;
  private sessionId: string | null = null;
  private messageListeners: Array<(message: WebSocketMessage) => void> = [];
  private stateListeners: Array<(state: ConnectionState) => void> = [];

  constructor(options: AgentClientOptions) {
    this.http = new AgentHttpClient({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      timeout: options.timeout,
      onError: options.onError,
    });

    if (options.enableWebSocket) {
      const wsUrl = options.webSocketUrl ?? options.baseUrl.replace(/^http/, 'ws');
      this.ws = new AgentWebSocketClient({
        url: wsUrl,
        onMessage: (message) => {
          this.messageListeners.forEach((listener) => listener(message));
        },
        onStateChange: (state) => {
          this.stateListeners.forEach((listener) => listener(state));
        },
        onError: options.onError,
      });
    }
  }

  async initialize(): Promise<string> {
    const { sessionId } = await this.http.createSession();
    this.sessionId = sessionId;
    return sessionId;
  }

  async createApiKey(name: string): Promise<{ key: string; name: string }> {
    const result = await this.http.createApiKey(name);
    return { key: result.key, name: result.name };
  }

  async sendMessage(message: string): Promise<ChatResponse> {
    if (!this.sessionId) {
      await this.initialize();
    }

    return this.http.chat(this.sessionId!, message);
  }

  async *streamMessage(message: string): AsyncGenerator<{ event: string; data: unknown }, void, unknown> {
    if (!this.sessionId) {
      await this.initialize();
    }

    yield* this.http.chatStream(this.sessionId!, message);
  }

  async streamMessageWithCallbacks(message: string, callbacks: StreamingChatCallbacks): Promise<void> {
    if (!this.sessionId) {
      await this.initialize();
    }

    await this.http.chatStreamWithCallbacks(this.sessionId!, message, callbacks);
  }

  async getHistory(): Promise<ChatMessage[]> {
    if (!this.sessionId) {
      return [];
    }

    const { messages } = await this.http.getHistory(this.sessionId);
    return messages;
  }

  async clearHistory(): Promise<void> {
    if (this.sessionId) {
      await this.http.clearHistory(this.sessionId);
    }
  }

  async endSession(): Promise<void> {
    if (this.sessionId) {
      await this.http.deleteSession(this.sessionId);
      this.sessionId = null;
    }
  }

  connectWebSocket(): void {
    this.ws?.connect();
  }

  disconnectWebSocket(): void {
    this.ws?.disconnect();
  }

  sendWebSocketMessage(message: WebSocketMessage): boolean {
    return this.ws?.send(message) ?? false;
  }

  onWebSocketMessage(listener: (message: WebSocketMessage) => void): () => void {
    this.messageListeners.push(listener);
    return () => {
      const index = this.messageListeners.indexOf(listener);
      if (index > -1) {
        this.messageListeners.splice(index, 1);
      }
    };
  }

  onConnectionStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.push(listener);
    return () => {
      const index = this.stateListeners.indexOf(listener);
      if (index > -1) {
        this.stateListeners.splice(index, 1);
      }
    };
  }

  getConnectionState(): ConnectionState {
    return this.ws?.getState() ?? 'disconnected';
  }

  isConnected(): boolean {
    return this.ws?.isConnected() ?? false;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.http.health();
      return response.status === 'ok';
    } catch {
      return false;
    }
  }
}
