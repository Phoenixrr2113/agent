import React from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/use-theme';
import { ChatList } from './chat-list';
import { ChatInput } from './chat-input';
import type { Message } from './types';

export interface ChatContainerProps {
  messages: Message[];
  isLoading?: boolean;
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  style?: ViewStyle;
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
  style,
  sendIcon,
  ListHeaderComponent,
  ListEmptyComponent,
}: ChatContainerProps) {
  const { colors } = useTheme();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }, style]}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
