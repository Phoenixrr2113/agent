import { useState, useCallback, useRef, useEffect } from 'react';
import type { Message, ChatState } from './types';

export interface UseChatOptions {
  initialMessages?: Message[];
  onSend?: (message: string) => Promise<string>;
  onError?: (error: Error) => void;
}

export interface UseChatReturn extends ChatState {
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  removeMessage: (id: string) => void;
  setSessionId: (sessionId: string | null) => void;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { initialMessages = [], onSend, onError } = options;

  const [state, setState] = useState<ChatState>({
    messages: initialMessages,
    isLoading: false,
    error: null,
    sessionId: null,
  });

  const addMessage = useCallback(
    (message: Omit<Message, 'id' | 'timestamp'>): Message => {
      const newMessage: Message = {
        ...message,
        id: generateId(),
        timestamp: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, newMessage],
      }));

      return newMessage;
    },
    []
  );

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    }));
  }, []);

  const removeMessage = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.filter((msg) => msg.id !== id),
    }));
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage = addMessage({
        role: 'user',
        content: content.trim(),
        status: 'sending',
      });

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        updateMessage(userMessage.id, { status: 'sent' });

        if (onSend) {
          const response = await onSend(content.trim());

          addMessage({
            role: 'assistant',
            content: response,
            status: 'sent',
          });
        }

        setState((prev) => ({ ...prev, isLoading: false }));
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        updateMessage(userMessage.id, { status: 'error' });
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message,
        }));

        onError?.(err);
      }
    },
    [addMessage, updateMessage, onSend, onError]
  );

  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      error: null,
    }));
  }, []);

  const setSessionId = useCallback((sessionId: string | null) => {
    setState((prev) => ({ ...prev, sessionId }));
  }, []);

  return {
    ...state,
    sendMessage,
    clearMessages,
    addMessage,
    updateMessage,
    removeMessage,
    setSessionId,
  };
}
