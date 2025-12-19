import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { ChatList } from './chat-list';
import { ChatInput } from './chat-input';
import type { Message } from './types';

export interface ChatContainerProps {
  messages: Message[];
  isLoading?: boolean;
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  sendIcon?: React.ReactNode;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
}

export function ChatContainer({
  messages,
  isLoading = false,
  onSend,
  disabled = false,
  placeholder,
  className = '',
  sendIcon,
  ListHeaderComponent,
  ListEmptyComponent,
}: ChatContainerProps) {
  return (
    <KeyboardAvoidingView
      className={`flex-1 bg-white dark:bg-gray-900 ${className}`.trim()}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ChatList
        messages={messages}
        isLoading={isLoading}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
      />
      <ChatInput
        onSend={onSend}
        disabled={disabled || isLoading}
        placeholder={placeholder}
        sendIcon={sendIcon}
      />
    </KeyboardAvoidingView>
  );
}
