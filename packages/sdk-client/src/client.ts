// Main client combining HTTP and WebSocket

import { AgentHttpClient } from './http-client';
import { AgentWebSocketClient } from './websocket-client';
import type { ChatRequest, ChatResponse, StreamingChatCallbacks, ChatMessage } from './types';

export interface AgentClientOptions {
  baseUrl: string;
  useWebSocket?: boolean;
}

export class AgentClient {
  private httpClient: AgentHttpClient;
  private wsClient?: AgentWebSocketClient;

  constructor(options: AgentClientOptions) {
    this.httpClient = new AgentHttpClient(options.baseUrl);
    if (options.useWebSocket) {
      const wsUrl = options.baseUrl.replace(/^http/, 'ws') + '/ws';
      this.wsClient = new AgentWebSocketClient({ url: wsUrl });
    }
  }

  async generate(request: ChatRequest): Promise<ChatResponse> {
    return this.httpClient.generate(request);
  }

  async stream(message: ChatMessage, callbacks: StreamingChatCallbacks): Promise<void> {
    if (!this.wsClient) {
      throw new Error('WebSocket not configured');
    }
    await this.wsClient.connect();
    this.wsClient.send(message, callbacks);
  }

  disconnect(): void {
    this.wsClient?.disconnect();
  }
}
