import type { ToolCallInfo, SourceInfo } from '@agent/api-client';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: 'sending' | 'streaming' | 'complete' | 'error';
  toolCalls?: ToolCallInfo[];
  sources?: SourceInfo[];
  reasoning?: {
    content: string;
    durationMs?: number;
  };
  stepIndex?: number;
  stepsUsed?: number;
  toolsUsed?: string[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  sessionId: string | null;
  currentStep: number;
}
