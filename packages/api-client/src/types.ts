export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  text: string;
  completed: boolean;
  needsInput: boolean;
  pendingQuestion?: string;
  stepsUsed: number;
  toolsUsed: string[];
  sessionId?: string;
  _httpTiming?: {
    totalRequestDurationMs: string;
  };
}

export interface SessionResponse {
  sessionId: string;
}

export interface HistoryResponse {
  messages: ChatMessage[];
}

export interface HealthResponse {
  status: 'ok' | 'error';
}

export interface StreamEvent {
  event: 'start' | 'chunk' | 'complete' | 'error';
  data: string;
}

export interface AgentClientConfig {
  baseUrl: string;
  timeout?: number;
  onError?: (error: Error) => void;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}
