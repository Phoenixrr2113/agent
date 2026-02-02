// Client types

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  sessionId?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  sessionId: string;
}

export interface SessionResponse {
  sessionId: string;
}

export interface HistoryResponse {
  messages: ChatMessage[];
}

export interface StreamingChatCallbacks {
  onText?: (text: string) => void;
  onToolCall?: (name: string, args: unknown) => void;
  onToolResult?: (name: string, result: unknown) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export interface StreamEvent {
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'complete' | 'error';
  data: unknown;
}

export type StreamEventCallback = (event: StreamEvent) => void;
