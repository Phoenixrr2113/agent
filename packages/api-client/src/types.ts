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
} from '@agent/shared';

export interface StreamingChatCallbacks {
  onSessionStart?: (data: { sessionId: string }) => void;
  onStepStart?: (data: { stepIndex: number }) => void;
  onStepFinish?: (data: { stepIndex: number; durationMs: number }) => void;
  onTextDelta?: (data: { delta: string; stepIndex: number }) => void;
  onReasoningDelta?: (data: { delta: string; stepIndex: number }) => void;
  onToolCall?: (data: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    stepIndex: number;
  }) => void;
  onToolResult?: (data: {
    toolCallId: string;
    toolName: string;
    result: unknown;
    durationMs: number;
    stepIndex: number;
  }) => void;
  onComplete?: (data: {
    text: string;
    completed: boolean;
    needsInput: boolean;
    pendingQuestion?: string;
    stepsUsed: number;
    toolsUsed: string[];
  }) => void;
  onError?: (data: { message: string; code?: string }) => void;
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
