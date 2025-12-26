import { useState, useCallback, useRef } from 'react';
import type {
  AgentClient,
  StreamingChatCallbacks,
  ToolCallInfo,
  SourceInfo,
} from '@agent/api-client';

export interface StreamingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  status: 'sending' | 'streaming' | 'complete' | 'error';
  stepIndex?: number;
  reasoning?: {
    content: string;
    durationMs?: number;
  };
  toolCalls: ToolCallInfo[];
  sources: SourceInfo[];
  stepsUsed?: number;
  toolsUsed?: string[];
}

export interface UseAgentChatOptions {
  client: AgentClient;
  onError?: (error: Error) => void;
}

export interface UseAgentChatReturn {
  messages: StreamingMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  currentStep: number;
}


function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Simple UUID v4 generator fallback for environments without crypto.randomUUID (like React Native)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function useAgentChat(options: UseAgentChatOptions): UseAgentChatReturn {
  const { client, onError } = options;

  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const currentMessageRef = useRef<StreamingMessage | null>(null);

  const updateCurrentMessage = useCallback((
    updater: (msg: StreamingMessage) => StreamingMessage
  ) => {
    setMessages(prev => {
      const lastIndex = prev.length - 1;
      if (lastIndex < 0) return prev;
      const updated = [...prev];
      updated[lastIndex] = updater(updated[lastIndex]!);
      currentMessageRef.current = updated[lastIndex]!;
      return updated;
    });
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    setError(null);
    setIsStreaming(true);
    setCurrentStep(0);

    const userMessage: StreamingMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'complete',
      toolCalls: [],
      sources: [],
    };

    const assistantMessage: StreamingMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
      toolCalls: [],
      sources: [],
    };

    currentMessageRef.current = assistantMessage;
    setMessages(prev => [...prev, userMessage, assistantMessage]);

    const callbacks: StreamingChatCallbacks = {
      onStepStart: (data) => {
        setCurrentStep(data.stepIndex);
        updateCurrentMessage(msg => ({
          ...msg,
          stepIndex: data.stepIndex,
        }));
      },

      onTextDelta: (data) => {
        updateCurrentMessage(msg => ({
          ...msg,
          content: msg.content + data.delta,
        }));
      },

      onReasoningDelta: (data) => {
        updateCurrentMessage(msg => ({
          ...msg,
          reasoning: {
            content: (msg.reasoning?.content ?? '') + data.delta,
            durationMs: msg.reasoning?.durationMs,
          },
        }));
      },

      onToolCall: (data) => {
        updateCurrentMessage(msg => ({
          ...msg,
          toolCalls: [
            ...msg.toolCalls,
            {
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              args: data.args,
              status: 'running' as const,
            },
          ],
        }));
      },

      onToolResult: (data) => {
        updateCurrentMessage(msg => ({
          ...msg,
          toolCalls: msg.toolCalls.map(tc =>
            tc.toolCallId === data.toolCallId
              ? {
                  ...tc,
                  status: 'complete' as const,
                  result: data.result,
                  durationMs: data.durationMs,
                }
              : tc
          ),
        }));
      },

      onComplete: (data) => {
        updateCurrentMessage(msg => ({
          ...msg,
          status: 'complete',
          stepsUsed: data.stepsUsed,
          toolsUsed: data.toolsUsed,
        }));
        setIsStreaming(false);
        setCurrentStep(0);
      },

      onError: (data) => {
        setError(data.message);
        updateCurrentMessage(msg => ({
          ...msg,
          status: 'error',
        }));
        setIsStreaming(false);
        onError?.(new Error(data.message));
      },
    };

    try {
      await client.streamMessageWithCallbacks(content, callbacks);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      updateCurrentMessage(msg => ({
        ...msg,
        status: 'error',
      }));
      setIsStreaming(false);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [client, updateCurrentMessage, onError]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    currentMessageRef.current = null;
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    currentStep,
  };
}
