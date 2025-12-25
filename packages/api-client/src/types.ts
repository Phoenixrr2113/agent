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

import type {
  StreamEventType,
  StreamEvent,
  StreamEventCallback,
  SessionStartData,
  StepStartData,
  StepFinishData,
  TextDeltaData,
  TextFinishData,
  ReasoningDeltaData,
  ReasoningFinishData,
  ToolCallData,
  ToolResultData,
  SourceData,
  ErrorData,
  CompleteData,
  StreamingMessage,
  ToolCallInfo,
  SourceInfo,
} from '@agent/shared';

export type {
  StreamEventType,
  StreamEvent,
  StreamEventCallback,
  SessionStartData,
  StepStartData,
  StepFinishData,
  TextDeltaData,
  TextFinishData,
  ReasoningDeltaData,
  ReasoningFinishData,
  ToolCallData,
  ToolResultData,
  SourceData,
  ErrorData,
  CompleteData,
  StreamingMessage,
  ToolCallInfo,
  SourceInfo,
};

export interface StreamingChatCallbacks {
  onSessionStart?: (data: SessionStartData) => void;
  onStepStart?: (data: StepStartData) => void;
  onStepFinish?: (data: StepFinishData) => void;
  onTextDelta?: (data: TextDeltaData) => void;
  onReasoningDelta?: (data: ReasoningDeltaData) => void;
  onToolCall?: (data: ToolCallData) => void;
  onToolResult?: (data: ToolResultData) => void;
  onComplete?: (data: CompleteData) => void;
  onError?: (data: ErrorData) => void;
}

export interface AgentClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  onError?: (error: Error) => void;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}
