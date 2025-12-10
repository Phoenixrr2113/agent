'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSession,
  deleteSession,
  getHistory,
  clearHistory,
  sendMessage,
  subscribeToAgentStream,
  type Session,
  type Message,
  type AgentStreamEvent,
  type AgentStreamStatus,
  type FileAttachment,
} from '@/lib/agent-api';

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
}

export interface AgentState {
  status: AgentStreamStatus | 'idle';
  thought?: string;
  currentStep: number;
  toolCalls: ToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
  };
  plan?: {
    title: string;
    description?: string;
    steps: Array<{
      id: string;
      label: string;
      status: 'pending' | 'running' | 'complete' | 'error';
    }>;
  };
  checkpoints: Array<{
    id: string;
    label: string;
    timestamp: string;
  }>;
  confirmation?: {
    id: string;
    toolName: string;
    message: string;
    state: 'pending' | 'approved' | 'rejected';
  };
  citations: Array<{
    id: string;
    text: string;
    sources: Array<{
      title?: string;
      url: string;
      description?: string;
    }>;
  }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentState?: AgentState;
  toolCalls?: ToolCall[];
}

export function useAgentChat() {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<AgentState>({
    status: 'idle',
    currentStep: 0,
    toolCalls: [],
    checkpoints: [],
    citations: [],
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);
  const agentStateRef = useRef<AgentState>(agentState);

  useEffect(() => {
    agentStateRef.current = agentState;
  }, [agentState]);

  const initSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const newSession = await createSession();
      setSession(newSession);
      setMessages([]);
      return newSession;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!session) return;
    try {
      const history = await getHistory(session.sessionId);
      const chatMessages: ChatMessage[] = history
        .filter((m): m is Message & { role: 'user' | 'assistant' } =>
          m.role === 'user' || m.role === 'assistant'
        )
        .map((m, i) => ({
          id: `history-${i}`,
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          timestamp: new Date(),
        }));
      setMessages(chatMessages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    }
  }, [session]);

  const handleStreamEvent = useCallback((event: AgentStreamEvent) => {
    setAgentState((prev) => {
      const newState = { ...prev };

      newState.status = event.status;
      if (event.step !== undefined) {
        newState.currentStep = event.step;
      }
      if (event.thought) {
        newState.thought = event.thought;
      }
      if (event.usage) {
        newState.usage = event.usage;
      }

      if (event.status === 'tool_calling' && event.toolName) {
        const existingTool = newState.toolCalls.find(
          (t) => t.name === event.toolName && t.status === 'pending'
        );
        if (!existingTool) {
          newState.toolCalls = [
            ...newState.toolCalls,
            {
              id: `tool-${Date.now()}`,
              name: event.toolName,
              input: event.toolInput,
              status: 'running',
              startTime: Date.now(),
            },
          ];
        }
      }

      if (event.status === 'tool_result' && event.toolName) {
        newState.toolCalls = newState.toolCalls.map((t) =>
          t.name === event.toolName && t.status === 'running'
            ? {
                ...t,
                output: event.toolOutput,
                status: 'completed' as const,
                endTime: Date.now(),
              }
            : t
        );
      }

      if (event.plan) {
        newState.plan = event.plan;
      }

      if (event.checkpoint) {
        newState.checkpoints = [...newState.checkpoints, event.checkpoint];
      }

      if (event.confirmation) {
        newState.confirmation = event.confirmation;
      }

      if (event.citations) {
        newState.citations = [...newState.citations, ...event.citations];
      }

      return newState;
    });

    if (event.status === 'complete' && event.response) {
      const messageId = currentMessageIdRef.current;
      if (messageId) {
        const currentAgentState = agentStateRef.current;
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === messageId);
          if (exists) {
            return prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    content: event.response!,
                    agentState: { ...currentAgentState, status: 'complete' },
                    toolCalls: currentAgentState.toolCalls,
                  }
                : m
            );
          }
          return [
            ...prev,
            {
              id: messageId,
              role: 'assistant' as const,
              content: event.response!,
              timestamp: new Date(),
              toolCalls: currentAgentState.toolCalls,
            },
          ];
        });
      }
      setIsLoading(false);
      currentMessageIdRef.current = null;
    }

    if (event.status === 'error') {
      setError(event.error || 'An error occurred');
      setIsLoading(false);
      currentMessageIdRef.current = null;
    }
  }, []);

  const send = useCallback(
    async (content: string, attachments?: FileAttachment[]) => {
      if (!content.trim() && (!attachments || attachments.length === 0)) return;

      let currentSession = session;
      if (!currentSession) {
        currentSession = await initSession();
        if (!currentSession) return;
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };

      const assistantMessageId = `assistant-${Date.now()}`;
      currentMessageIdRef.current = assistantMessageId;

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);
      setAgentState({
        status: 'thinking',
        currentStep: 0,
        toolCalls: [],
        checkpoints: [],
        citations: [],
      });

      try {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }

        await sendMessage(currentSession.sessionId, content, attachments);

        const pollForResponse = async () => {
          const maxPolls = 60;
          let polls = 0;

          while (polls < maxPolls) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            polls++;

            const history = await getHistory(currentSession.sessionId);
            const messages = history.filter(
              (m): m is Message & { role: 'user' | 'assistant' } =>
                m.role === 'user' || m.role === 'assistant'
            );

            const lastMessage = messages[messages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              const responseContent = typeof lastMessage.content === 'string'
                ? lastMessage.content
                : JSON.stringify(lastMessage.content);

              const messageId = currentMessageIdRef.current;
              if (messageId) {
                setMessages((prev) => {
                  const exists = prev.some((m) => m.id === messageId);
                  if (exists) {
                    return prev.map((m) =>
                      m.id === messageId
                        ? { ...m, content: responseContent }
                        : m
                    );
                  }
                  return [
                    ...prev,
                    {
                      id: messageId,
                      role: 'assistant' as const,
                      content: responseContent,
                      timestamp: new Date(),
                    },
                  ];
                });
              }

              setAgentState(prev => ({ ...prev, status: 'complete' }));
              setIsLoading(false);
              currentMessageIdRef.current = null;
              return;
            }
          }

          setError('Response timeout');
          setIsLoading(false);
        };

        pollForResponse();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send message');
        setIsLoading(false);
        currentMessageIdRef.current = null;
      }
    },
    [session, initSession]
  );

  const regenerate = useCallback(async () => {
    if (!session || messages.length < 2) return;

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) return;

    setMessages((prev) => {
      const lastUserIndex = prev.map((m) => m.role).lastIndexOf('user');
      if (lastUserIndex === -1) return prev;
      return prev.slice(0, lastUserIndex);
    });

    await send(lastUserMessage.content);
  }, [session, messages, send]);

  const clear = useCallback(async () => {
    if (!session) return;
    try {
      await clearHistory(session.sessionId);
      setMessages([]);
      setAgentState({
        status: 'idle',
        currentStep: 0,
        toolCalls: [],
        checkpoints: [],
        citations: [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear history');
    }
  }, [session]);

  const endSession = useCallback(async () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (session) {
      try {
        await deleteSession(session.sessionId);
      } catch (e) {
        console.error('Failed to delete session:', e);
      }
    }
    setSession(null);
    setMessages([]);
    setAgentState({
      status: 'idle',
      currentStep: 0,
      toolCalls: [],
      checkpoints: [],
      citations: [],
    });
  }, [session]);

  const copyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    session,
    messages,
    isLoading,
    error,
    agentState,
    initSession,
    loadHistory,
    send,
    regenerate,
    clear,
    endSession,
    copyMessage,
  };
}
