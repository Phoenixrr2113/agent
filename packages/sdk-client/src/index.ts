// @agent/sdk-client - Main exports
// Re-exports client functionality for connecting to @agent/sdk-server

export { AgentClient, type AgentClientOptions } from './client';
export { AgentHttpClient } from './http-client';
export { AgentWebSocketClient, type WebSocketClientConfig } from './websocket-client';
export { ApiClientError, WebSocketError } from './errors';
export type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  SessionResponse,
  HistoryResponse,
  StreamingChatCallbacks,
  StreamEvent,
  StreamEventCallback,
} from './types';
