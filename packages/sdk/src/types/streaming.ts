/**
 * @agent/sdk - Streaming Types
 * Standalone streaming event types for agent communication
 */

export type StreamEventType =
  | 'session:start'
  | 'step:start'
  | 'step:finish'
  | 'text:delta'
  | 'text:finish'
  | 'reasoning:delta'
  | 'reasoning:finish'
  | 'tool:call'
  | 'tool:result'
  | 'sources:add'
  | 'error'
  | 'complete';

export interface SessionStartData {
  sessionId: string;
}

export interface StepStartData {
  stepIndex: number;
}

export interface StepFinishData {
  stepIndex: number;
  durationMs: number;
}

export interface TextDeltaData {
  delta: string;
  stepIndex: number;
}

export interface TextFinishData {
  text: string;
  stepIndex: number;
}

export interface ReasoningDeltaData {
  delta: string;
  stepIndex: number;
}

export interface ReasoningFinishData {
  reasoning: string;
  durationMs: number;
  stepIndex: number;
}

export interface ToolCallData {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  stepIndex: number;
}

export interface ToolResultData {
  toolCallId: string;
  toolName: string;
  result: unknown;
  durationMs: number;
  stepIndex: number;
}

export interface SourceData {
  id: string;
  title: string;
  url?: string;
  snippet?: string;
}

export interface ErrorData {
  message: string;
  code?: string;
  stepIndex?: number;
}

export interface CompleteData {
  text: string;
  completed: boolean;
  needsInput: boolean;
  pendingQuestion?: string;
  stepsUsed: number;
  toolsUsed: string[];
}

export type StreamEventDataMap = {
  'session:start': SessionStartData;
  'step:start': StepStartData;
  'step:finish': StepFinishData;
  'text:delta': TextDeltaData;
  'text:finish': TextFinishData;
  'reasoning:delta': ReasoningDeltaData;
  'reasoning:finish': ReasoningFinishData;
  'tool:call': ToolCallData;
  'tool:result': ToolResultData;
  'sources:add': SourceData;
  error: ErrorData;
  complete: CompleteData;
};

export interface StreamEvent<T extends StreamEventType = StreamEventType> {
  type: T;
  data: StreamEventDataMap[T];
  timestamp: number;
}

export type StreamEventCallback = (
  event: StreamEvent
) => void | Promise<void>;

export type MessagePartType =
  | 'text'
  | 'reasoning'
  | 'tool-call'
  | 'tool-result'
  | 'source';

export interface MessagePart {
  type: MessagePartType;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCallInfo {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'complete' | 'error';
  result?: unknown;
  durationMs?: number;
  stepIndex?: number;
}

export interface SourceInfo {
  id: string;
  title: string;
  url?: string;
  snippet?: string;
}

export interface StreamingMessage {
  id: string;
  role: 'assistant';
  parts: MessagePart[];
  status: 'streaming' | 'complete';
  stepIndex: number;
  text: string;
  reasoning?: {
    content: string;
    durationMs?: number;
  };
  toolCalls: ToolCallInfo[];
  sources: SourceInfo[];
}
